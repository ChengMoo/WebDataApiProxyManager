fn build_frontend_router(frontend_assets: FrontendAssets) -> Router {
    let Some(root) = frontend_assets.root.clone() else {
        return Router::new();
    };

    let assets_dir = root.join("assets");
    let asset_cache_control = HeaderValue::from_static("public, max-age=31536000, immutable");
    let assets_service = get_service(ServeDir::new(assets_dir)).layer(
        SetResponseHeaderLayer::if_not_present(CACHE_CONTROL, asset_cache_control),
    );

    Router::new()
        .nest_service("/assets", assets_service)
        .route("/", get(serve_frontend_index))
        .route("/{*path}", get(serve_frontend_path))
        .with_state(frontend_assets)
        .layer(CompressionLayer::new())
}

impl FrontendAssets {
    fn discover() -> Self {
        let candidates = [
            PathBuf::from("/srv/www"),
            env::current_dir()
                .map(|path| path.join("crates/web/app/dist"))
                .unwrap_or_else(|_| PathBuf::from("crates/web/app/dist")),
        ];

        for candidate in candidates {
            if candidate.is_dir() {
                let index_path = candidate.join("index.html");
                let index_html = match std::fs::read(&index_path) {
                    Ok(bytes) => Some(Bytes::from(bytes)),
                    Err(error) => {
                        warn!(path = %index_path.display(), %error, "frontend index.html is unavailable");
                        None
                    }
                };
                info!(root = %candidate.display(), "frontend assets root resolved");
                return Self {
                    root: Some(candidate),
                    index_html,
                };
            }
        }

        warn!("frontend assets root not found; web console static files will return 404");
        Self {
            root: None,
            index_html: None,
        }
    }
}

async fn serve_frontend_index(
    axum::extract::State(frontend_assets): axum::extract::State<FrontendAssets>,
) -> Response {
    frontend_index_response(&frontend_assets)
}

async fn serve_frontend_path(
    axum::extract::State(frontend_assets): axum::extract::State<FrontendAssets>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Response {
    if should_fallback_to_index(path.as_str()) {
        return frontend_index_response(&frontend_assets);
    }

    serve_frontend_static_file(&frontend_assets, path.as_str()).await
}

fn frontend_index_response(frontend_assets: &FrontendAssets) -> Response {
    let Some(index_html) = frontend_assets.index_html.clone() else {
        return StatusCode::NOT_FOUND.into_response();
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(
            CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        )
        .header(CACHE_CONTROL, HeaderValue::from_static("no-cache"))
        .body(Body::from(index_html))
        .unwrap_or_else(|error| {
            error!(%error, "failed to build frontend index response");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        })
}

fn should_fallback_to_index(request_path: &str) -> bool {
    let trimmed = request_path.trim_matches('/');
    if trimmed.is_empty() {
        return true;
    }

    Path::new(trimmed)
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| !value.contains('.'))
        .unwrap_or(false)
}

async fn serve_frontend_static_file(
    frontend_assets: &FrontendAssets,
    request_path: &str,
) -> Response {
    let Some(root) = frontend_assets.root.as_ref() else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let Some(relative_path) = sanitize_frontend_static_path(request_path) else {
        warn!(path = request_path, "rejected invalid frontend static file path");
        return StatusCode::NOT_FOUND.into_response();
    };

    let file_path = root.join(&relative_path);
    match tokio::fs::read(&file_path).await {
        Ok(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_TYPE, HeaderValue::from_static(frontend_content_type(&file_path)))
            .header(
                CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=3600"),
            )
            .body(Body::from(bytes))
            .unwrap_or_else(|error| {
                error!(%error, path = %file_path.display(), "failed to build frontend static file response");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            warn!(path = %file_path.display(), "frontend static file not found");
            StatusCode::NOT_FOUND.into_response()
        }
        Err(error) => {
            error!(%error, path = %file_path.display(), "failed to read frontend static file");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

fn sanitize_frontend_static_path(request_path: &str) -> Option<PathBuf> {
    let mut sanitized = PathBuf::new();
    for component in Path::new(request_path.trim_matches('/')).components() {
        match component {
            Component::Normal(part) => sanitized.push(part),
            _ => return None,
        }
    }

    if sanitized.as_os_str().is_empty() {
        return None;
    }

    Some(sanitized)
}

fn frontend_content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()) {
        Some("css") => "text/css; charset=utf-8",
        Some("html") => "text/html; charset=utf-8",
        Some("ico") => "image/x-icon",
        Some("jpeg") => "image/jpeg",
        Some("jpg") => "image/jpeg",
        Some("js") => "text/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("map") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("txt") => "text/plain; charset=utf-8",
        Some("webp") => "image/webp",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}
