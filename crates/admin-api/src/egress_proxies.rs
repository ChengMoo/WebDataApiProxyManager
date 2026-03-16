async fn create_egress_proxy(
    State(state): State<AdminApiState>,
    headers: HeaderMap,
    Json(payload): Json<CreateEgressProxyRequest>,
) -> Result<(StatusCode, Json<EgressProxySummary>), AdminApiError> {
    let admin_identity = authorize_with_identity(&headers, &state.storage).await?;
    let name = require_non_empty(payload.name.as_str(), "egress proxy name is required")?;
    let proxy_url = require_non_empty(payload.proxy_url.as_str(), "egress proxy url is required")?;
    let kind = EgressProxyKind::from_proxy_url(&proxy_url)
        .map_err(|error| AdminApiError::BadRequest(error.to_string()))?;
    let proxy = EgressProxy {
        id: payload
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| generate_named_id("proxy", name.as_str())),
        name,
        kind,
        proxy_url,
        region: normalize_optional_text(payload.region),
        enabled: payload.enabled.unwrap_or(true),
        status: if payload.enabled.unwrap_or(true) {
            EgressProxyStatus::Active
        } else {
            EgressProxyStatus::Disabled
        },
        last_error: None,
        cooldown_until: None,
        last_used_at: None,
        consecutive_failures: 0,
    };
    state.storage.create_egress_proxy(&proxy).await?;
    let summary = state
        .storage
        .list_egress_proxies()
        .await?
        .into_iter()
        .find(|item| item.id == proxy.id)
        .ok_or_else(|| AdminApiError::NotFound(proxy.id.clone()))?;

    emit_audit(
        &state,
        &admin_identity,
        "create",
        "egress_proxy",
        Some(&proxy.id),
        None,
        Some(serde_json::json!({"name": proxy.name, "kind": proxy.kind.as_str()})),
    )
    .await;

    info!(egress_proxy_id = %proxy.id, kind = proxy.kind.as_str(), "admin created egress proxy");

    Ok((StatusCode::CREATED, Json(summary)))
}

async fn update_egress_proxy(
    State(state): State<AdminApiState>,
    Path(proxy_id): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<UpdateEgressProxyRequest>,
) -> Result<Json<EgressProxySummary>, AdminApiError> {
    let admin_identity = authorize_with_identity(&headers, &state.storage).await?;
    let name = optional_non_empty(payload.name.as_ref(), "egress proxy name cannot be empty")?;
    let proxy_url = optional_non_empty(
        payload.proxy_url.as_ref(),
        "egress proxy url cannot be empty",
    )?;
    if let Some(proxy_url) = proxy_url.as_ref() {
        EgressProxyKind::from_proxy_url(proxy_url.trim())
            .map_err(|error| AdminApiError::BadRequest(error.to_string()))?;
    }
    let region = if payload.clear_region.unwrap_or(false) {
        Some(None)
    } else {
        payload.region.map(normalize_text)
    };
    let updated = state
        .storage
        .update_egress_proxy(&proxy_id, name, proxy_url, region, payload.enabled)
        .await?;

    if !updated {
        return Err(AdminApiError::NotFound(proxy_id));
    }

    let summary = state
        .storage
        .list_egress_proxies()
        .await?
        .into_iter()
        .find(|item| item.id == proxy_id)
        .ok_or_else(|| AdminApiError::NotFound(proxy_id.clone()))?;

    emit_audit(
        &state,
        &admin_identity,
        "update",
        "egress_proxy",
        Some(&proxy_id),
        None,
        None,
    )
    .await;

    info!(egress_proxy_id = %proxy_id, "admin updated egress proxy");

    Ok(Json(summary))
}
