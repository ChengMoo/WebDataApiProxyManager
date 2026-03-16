async fn store_admin_session(storage: &StorageService, token: &str) -> Result<(), AdminApiError> {
    storage
        .set_admin_session(&hash_token(token), &session_expires_at())
        .await?;
    Ok(())
}

async fn auth_status(
    State(state): State<AdminApiState>,
) -> Result<Json<AuthStatusResponse>, AdminApiError> {
    let initialized = state
        .storage
        .get_admin_config("admin_password_hash")
        .await?
        .is_some();
    Ok(Json(AuthStatusResponse { initialized }))
}

async fn auth_setup(
    State(state): State<AdminApiState>,
    Json(payload): Json<AuthSetupRequest>,
) -> Result<(StatusCode, Json<AuthSetupResponse>), AdminApiError> {
    let existing = state
        .storage
        .get_admin_config("admin_password_hash")
        .await?;
    if existing.is_some() {
        return Err(AdminApiError::BadRequest(
            "admin password is already configured".to_owned(),
        ));
    }
    let password = payload.password.trim();
    if password.len() < 8 {
        return Err(AdminApiError::BadRequest(
            "password must be at least 8 characters".to_owned(),
        ));
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|err| AdminApiError::BadRequest(format!("failed to hash password: {err}")))?;
    state
        .storage
        .set_admin_config("admin_password_hash", hash.to_string().as_str())
        .await?;
    state
        .storage
        .ensure_tenant(state.default_tenant_id.as_str(), "Default Tenant")
        .await?;
    let token = generate_random_token();
    store_admin_session(&state.storage, &token).await?;

    info!("admin password configured via setup");
    Ok((StatusCode::CREATED, Json(AuthSetupResponse { token })))
}

async fn auth_login(
    State(state): State<AdminApiState>,
    Json(payload): Json<AuthLoginRequest>,
) -> Result<Json<AuthTokenResponse>, AdminApiError> {
    let stored_hash = state
        .storage
        .get_admin_config("admin_password_hash")
        .await?
        .ok_or_else(|| {
            AdminApiError::BadRequest("admin password is not configured yet".to_owned())
        })?;
    let parsed_hash =
        PasswordHash::new(&stored_hash).map_err(|_| AdminApiError::InvalidAdminCredentials)?;
    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AdminApiError::InvalidAdminCredentials)?;
    let token = generate_random_token();
    store_admin_session(&state.storage, &token).await?;
    info!("admin logged in");
    Ok(Json(AuthTokenResponse { token }))
}
