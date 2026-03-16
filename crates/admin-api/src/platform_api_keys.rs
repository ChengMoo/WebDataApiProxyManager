async fn list_platform_api_keys_handler(
    State(state): State<AdminApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<PlatformApiKeyRecord>>, AdminApiError> {
    authorize(&headers, &state.storage).await?;
    let keys = state
        .storage
        .list_platform_api_keys(state.default_tenant_id.as_str())
        .await?;
    Ok(Json(keys))
}

async fn create_platform_api_key_handler(
    State(state): State<AdminApiState>,
    headers: HeaderMap,
    Json(payload): Json<CreatePlatformApiKeyRequest>,
) -> Result<(StatusCode, Json<CreatePlatformApiKeyResponse>), AdminApiError> {
    let admin_identity = authorize_with_identity(&headers, &state.storage).await?;
    let name = require_non_empty(payload.name.as_str(), "platform api key name is required")?;
    let quota = validate_non_negative(
        payload.quota.unwrap_or(0),
        "platform api key quota must be greater than or equal to 0",
    )?;
    let plaintext_key = generate_platform_api_key();
    let key_hash = hash_token(&plaintext_key);
    let key_prefix = plaintext_key[..12].to_owned();
    let key_id = Uuid::now_v7().to_string();

    state
        .storage
        .insert_platform_api_key(PlatformApiKeyInsert {
            id: &key_id,
            tenant_id: state.default_tenant_id.as_str(),
            name: &name,
            key_hash: &key_hash,
            key_prefix: &key_prefix,
            plaintext_key: &plaintext_key,
            quota,
        })
        .await?;

    emit_audit(
        &state,
        &admin_identity,
        "create",
        "platform_api_key",
        Some(&key_id),
        None,
        Some(serde_json::json!({"name": name})),
    )
    .await;

    info!(platform_api_key_id = %key_id, "admin created platform api key");

    Ok((
        StatusCode::CREATED,
        Json(CreatePlatformApiKeyResponse {
            id: key_id,
            name,
            key: plaintext_key,
            key_prefix,
            quota,
        }),
    ))
}

async fn update_platform_api_key_handler(
    State(state): State<AdminApiState>,
    Path(key_id): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<UpdatePlatformApiKeyRequest>,
) -> Result<Json<PlatformApiKeyRecord>, AdminApiError> {
    let admin_identity = authorize_with_identity(&headers, &state.storage).await?;

    let existing = state
        .storage
        .list_platform_api_keys(state.default_tenant_id.as_str())
        .await?
        .into_iter()
        .find(|k| k.id == key_id)
        .ok_or_else(|| AdminApiError::NotFound(format!("platform api key `{key_id}`")))?;

    let name = payload
        .name
        .as_ref()
        .map(|value| {
            require_non_empty(value.as_str(), "platform api key name cannot be empty")
        })
        .transpose()?
        .unwrap_or(existing.name.clone());
    let quota = validate_non_negative(
        payload.quota.unwrap_or(existing.quota),
        "platform api key quota must be greater than or equal to 0",
    )?;

    let updated = state
        .storage
        .update_platform_api_key(&key_id, &name, quota)
        .await?;

    if !updated {
        return Err(AdminApiError::NotFound(format!(
            "platform api key `{key_id}`"
        )));
    }

    emit_audit(
        &state,
        &admin_identity,
        "update",
        "platform_api_key",
        Some(&key_id),
        None,
        Some(serde_json::json!({"name": name, "quota": quota})),
    )
    .await;

    info!(platform_api_key_id = %key_id, "admin updated platform api key");

    let record = state
        .storage
        .list_platform_api_keys(state.default_tenant_id.as_str())
        .await?
        .into_iter()
        .find(|k| k.id == key_id)
        .ok_or_else(|| AdminApiError::NotFound(format!("platform api key `{key_id}`")))?;

    Ok(Json(record))
}

async fn get_platform_api_key_secret_handler(
    State(state): State<AdminApiState>,
    Path(key_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<RevealPlatformApiKeyResponse>, AdminApiError> {
    let admin_identity = authorize_with_identity(&headers, &state.storage).await?;
    let secret = state
        .storage
        .get_platform_api_key_secret(&key_id)
        .await?
        .ok_or_else(|| AdminApiError::NotFound(format!("platform api key `{key_id}`")))?;

    emit_audit(
        &state,
        &admin_identity,
        "reveal",
        "platform_api_key",
        Some(&key_id),
        None,
        None,
    )
    .await;

    info!(platform_api_key_id = %key_id, "admin revealed platform api key");

    Ok(Json(RevealPlatformApiKeyResponse { key: secret }))
}

async fn revoke_platform_api_key_handler(
    State(state): State<AdminApiState>,
    Path(key_id): Path<String>,
    headers: HeaderMap,
) -> Result<StatusCode, AdminApiError> {
    let admin_identity = authorize_with_identity(&headers, &state.storage).await?;
    let revoked = state.storage.revoke_platform_api_key(&key_id).await?;
    if !revoked {
        return Err(AdminApiError::NotFound(format!(
            "platform api key `{key_id}`"
        )));
    }

    emit_audit(
        &state,
        &admin_identity,
        "revoke",
        "platform_api_key",
        Some(&key_id),
        None,
        None,
    )
    .await;

    info!(platform_api_key_id = %key_id, "admin revoked platform api key");

    Ok(StatusCode::NO_CONTENT)
}
