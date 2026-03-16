async fn authorize(
    headers: &HeaderMap,
    storage: &StorageService,
) -> Result<PlatformApiKeyRecord, GatewayError> {
    let value = headers
        .get(AUTHORIZATION)
        .ok_or(GatewayError::MissingAuthorization)?;
    let raw = value
        .to_str()
        .map_err(|_| GatewayError::InvalidAuthorization)?;
    let token = raw
        .strip_prefix("Bearer ")
        .or_else(|| raw.strip_prefix("bearer "))
        .ok_or(GatewayError::InvalidAuthorization)?;

    let key_hash = hash_token(token);
    let key_record = storage
        .find_platform_api_key_by_hash(&key_hash)
        .await
        .map_err(GatewayError::WebhookStorage)?;

    let Some(key_record) = key_record else {
        return Err(GatewayError::InvalidPlatformKey);
    };

    if !storage
        .increment_platform_api_key_counter(&key_record.id)
        .await
        .map_err(GatewayError::WebhookStorage)?
    {
        return Err(GatewayError::QuotaExceeded);
    }

    Ok(key_record)
}

fn flatten_headers(headers: &HeaderMap) -> HeaderValues {
    headers
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.as_str().to_owned(), value.to_owned()))
        })
        .collect()
}

fn should_forward_request_header(name: &HeaderName) -> bool {
    name != AUTHORIZATION
        && name != CONNECTION
        && name != CONTENT_LENGTH
        && name != HOST
        && name != TRANSFER_ENCODING
}

fn should_forward_response_header(name: &HeaderName) -> bool {
    name != CONNECTION && name != CONTENT_LENGTH && name != TRANSFER_ENCODING
}

fn format_route(provider: &str, rest: &str) -> String {
    let trimmed = rest.trim_matches('/');
    if trimmed.is_empty() {
        format!("/{provider}")
    } else {
        format!("/{provider}/{trimmed}")
    }
}
