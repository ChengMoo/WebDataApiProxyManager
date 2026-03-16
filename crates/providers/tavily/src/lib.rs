use std::sync::Arc;

use wdapm_core::{
    ProviderAccount, ProviderAdapter, ProviderAuth, ProviderError, ProviderId,
    ProviderResponseClass, ProviderRoute, RequestEnvelope, UpstreamRequestPlan, join_url,
    normalize_rest_path,
};

pub fn adapter() -> Arc<dyn ProviderAdapter> {
    Arc::new(TavilyAdapter)
}

struct TavilyAdapter;

impl ProviderAdapter for TavilyAdapter {
    fn provider_id(&self) -> ProviderId {
        ProviderId::Tavily
    }

    fn parse_route(
        &self,
        rest_path: &str,
        query: Option<&str>,
    ) -> Result<ProviderRoute, ProviderError> {
        Ok(ProviderRoute {
            base_url_override: None,
            upstream_path: normalize_rest_path(rest_path)?,
            query: query.map(ToOwned::to_owned),
        })
    }

    fn build_upstream_request(
        &self,
        _request: &RequestEnvelope,
        route: &ProviderRoute,
        account: &ProviderAccount,
    ) -> Result<UpstreamRequestPlan, ProviderError> {
        Ok(UpstreamRequestPlan {
            provider: ProviderId::Tavily,
            url: join_url(
                account.base_url(),
                &route.upstream_path,
                route.query.as_deref(),
            ),
            auth: ProviderAuth::Bearer(account.api_key.clone()),
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
