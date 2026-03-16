async fn webhook_firecrawl(
    State(state): State<GatewayState>,
    Query(query): Query<WebhookQuery>,
    body: Bytes,
) -> Result<Response, GatewayError> {
    let job = state
        .storage
        .find_provider_async_job_by_webhook_secret(&query.secret)
        .await
        .map_err(GatewayError::WebhookStorage)?;
    let Some(job) = job else {
        return Ok(StatusCode::OK.into_response());
    };
    if job.settled_at.is_some() {
        return Ok(StatusCode::OK.into_response());
    };
    let parsed = match parse_webhook_payload(body.as_ref()) {
        Ok(parsed) => parsed,
        Err(err) => {
            error!(async_job_id = job.id.as_str(), error = %err, "failed to parse firecrawl webhook payload");
            return Ok(StatusCode::OK.into_response());
        }
    };
    if !parsed.state.is_terminal() {
        info!(
            async_job_id = job.id.as_str(),
            state = parsed.state.as_str(),
            "firecrawl webhook received non-terminal state"
        );
        return Ok(StatusCode::OK.into_response());
    }
    match state
        .worker
        .settle_async_job(&job, parsed.state, parsed.metadata)
        .await
    {
        Ok(claimed) => {
            info!(
                async_job_id = job.id.as_str(),
                state = parsed.state.as_str(),
                claimed,
                "firecrawl webhook processed"
            );
        }
        Err(err) => {
            error!(async_job_id = job.id.as_str(), error = %err, "firecrawl webhook settlement failed");
        }
    }
    Ok(StatusCode::OK.into_response())
}
