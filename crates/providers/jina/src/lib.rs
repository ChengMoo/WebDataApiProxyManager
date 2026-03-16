use std::sync::Arc;

use wdapm_core::{
    ProviderAccount, ProviderAdapter, ProviderAuth, ProviderError, ProviderId,
    ProviderResponseClass, ProviderRoute, RequestEnvelope, UpstreamRequestPlan, join_url,
};

pub fn adapter() -> Arc<dyn ProviderAdapter> {
    Arc::new(JinaAdapter)
}

struct JinaAdapter;

impl ProviderAdapter for JinaAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::Jina
    }

    fn parse_route(
        &self,
        rest_path: &str,
        query: Option<&str>,
    ) -> Result<ProviderRoute, ProviderError> {
        let trimmed = rest_path.trim_matches('/');
        let (base_url_override, upstream_path) = if let Some(target) = trimmed.strip_prefix("r/") {
            (
                "https://r.jina.ai".to_owned(),
                format!("/{}", target.trim_start_matches('/')),
            )
        } else if let Some(target) = trimmed.strip_prefix("s/") {
            (
                "https://s.jina.ai".to_owned(),
                format!("/{}", target.trim_start_matches('/')),
            )
        } else {
            return Err(ProviderError::InvalidRoute(
                "jina routes must start with `r/` or `s/`".to_owned(),
            ));
        };

        if upstream_path == "/" {
            return Err(ProviderError::InvalidRoute(
                "jina target path cannot be empty".to_owned(),
            ));
        }

        Ok(ProviderRoute {
            base_url_override: Some(base_url_override),
            upstream_path,
            query: query.map(ToOwned::to_owned),
        })
    }

    fn build_upstream_request(
        &self,
        _request: &RequestEnvelope,
        route: &ProviderRoute,
        account: &ProviderAccount,
    ) -> Result<UpstreamRequestPlan, ProviderError> {
        let base_url = route
            .base_url_override
            .as_deref()
            .unwrap_or(account.base_url());
        let auth = if account.api_key.is_empty() {
            ProviderAuth::None
        } else {
            ProviderAuth::Bearer(account.api_key.clone())
        };

        Ok(UpstreamRequestPlan {
            provider: ProviderId::Jina,
            url: join_url(base_url, &route.upstream_path, route.query.as_deref()),
            auth,
        })
    }

    fn classify_response(&self, status: u16) -> ProviderResponseClass {
        match status {
            401 | 403 => ProviderResponseClass::disable_account(),
            429 => ProviderResponseClass::cooldown(),
            500..=599 => ProviderResponseClass::retryable(),
            _ => ProviderResponseClass::passthrough(),
        }
    }
}
