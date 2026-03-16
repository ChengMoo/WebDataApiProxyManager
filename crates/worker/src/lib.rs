use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration as StdDuration;

use reqwest::{Client, Proxy, StatusCode};
use thiserror::Error;
use time::{Duration, OffsetDateTime};
use tracing::{error, info};
use wdapm_core::{
    AlertEventInsert, AlertRuleKind, EgressProxy, ProviderAsyncJobRecord, ProviderAsyncJobState,
    ProviderAsyncJobUpdate, ProviderId, calculate_cooldown_seconds, join_url,
    parse_sqlite_timestamp, sqlite_timestamp, summarize_proxy_url,
};
use wdapm_provider_firecrawl::parse_async_job_status;
use wdapm_storage::{StorageError, StorageService};

const FIRECRAWL_DEFAULT_POLL_DELAY_SECONDS: i64 = 30;
const FIRECRAWL_RETRY_POLL_DELAY_SECONDS: i64 = 60;
const ALERT_RETRIGGER_WINDOW_SECONDS: i64 = 600;
const UPSTREAM_CONNECT_TIMEOUT_SECONDS: u64 = 5;
const UPSTREAM_REQUEST_TIMEOUT_SECONDS: u64 = 60;
const UPSTREAM_IDLE_TIMEOUT_SECONDS: u64 = 90;

#[derive(Clone)]
pub struct WorkerService {
    storage: Arc<StorageService>,
    client_pool: ClientPool,
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct ReconcileReport {
    pub provider: &'static str,
    pub scanned: usize,
    pub progressed: usize,
    pub settled: usize,
    pub failed: usize,
}

struct FinalizeJob<'a> {
    job: &'a ProviderAsyncJobRecord,
    account_id: &'a str,
    status: StatusCode,
    state: ProviderAsyncJobState,
    metadata: serde_json::Value,
    egress_mode: &'a str,
    egress_target: &'a str,
}

#[derive(Clone, Default)]
struct ClientPool {
    clients: Arc<RwLock<HashMap<String, Client>>>,
}

impl ClientPool {
    fn client_for(&self, egress_proxy: Option<&EgressProxy>) -> Result<Client, WorkerError> {
        let key = egress_proxy
            .map(|value| value.proxy_url.clone())
            .unwrap_or_else(|| "__direct__".to_owned());
        if let Some(client) = self
            .clients
            .read()
            .map_err(|_| WorkerError::ClientPoolPoisoned)?
            .get(&key)
            .cloned()
        {
            return Ok(client);
        }

        let mut builder = Client::builder()
            .connect_timeout(StdDuration::from_secs(UPSTREAM_CONNECT_TIMEOUT_SECONDS))
            .timeout(StdDuration::from_secs(UPSTREAM_REQUEST_TIMEOUT_SECONDS))
            .pool_idle_timeout(StdDuration::from_secs(UPSTREAM_IDLE_TIMEOUT_SECONDS));
        if let Some(egress_proxy) = egress_proxy {
            builder = builder.proxy(Proxy::all(&egress_proxy.proxy_url)?);
        }
        let client = builder.build()?;
        let mut clients = self
            .clients
            .write()
            .map_err(|_| WorkerError::ClientPoolPoisoned)?;
        if let Some(existing) = clients.get(&key).cloned() {
            Ok(existing)
        } else {
            clients.insert(key, client.clone());
            Ok(client)
        }
    }
}

impl WorkerService {
    pub fn new(storage: Arc<StorageService>) -> Self {
        Self {
            storage,
            client_pool: ClientPool::default(),
        }
    }

    pub async fn reconcile_firecrawl_jobs(
        &self,
        limit: i64,
    ) -> Result<ReconcileReport, WorkerError> {
        let jobs = self
            .storage
            .list_due_provider_async_jobs(ProviderId::Firecrawl, limit)
            .await?;
        let mut report = ReconcileReport {
            provider: ProviderId::Firecrawl.as_str(),
            scanned: jobs.len(),
            progressed: 0,
            settled: 0,
            failed: 0,
        };

        for job in jobs {
            match self.reconcile_firecrawl_job(&job).await {
                Ok(JobProgress::Progressed) => {
                    report.progressed += 1;
                }
                Ok(JobProgress::Settled) => {
                    report.progressed += 1;
                    report.settled += 1;
                }
                Ok(JobProgress::Failed) => {
                    report.progressed += 1;
                    report.failed += 1;
                }
                Err(error) => {
                    report.failed += 1;
                    error!(async_job_id = job.id.as_str(), error = %error, "firecrawl async job reconciliation failed");
                }
            }
        }

        info!(
            scanned = report.scanned,
            progressed = report.progressed,
            settled = report.settled,
            failed = report.failed,
            "firecrawl async reconciliation completed"
        );

        Ok(report)
    }

    pub async fn settle_async_job(
        &self,
        job: &ProviderAsyncJobRecord,
        state: ProviderAsyncJobState,
        metadata: serde_json::Value,
    ) -> Result<bool, WorkerError> {
        let account_id = job.provider_account_id.as_deref().unwrap_or("unknown");
        self.finalize_job(FinalizeJob {
            job,
            account_id,
            status: StatusCode::OK,
            state,
            metadata,
            egress_mode: "webhook",
            egress_target: "webhook",
        })
        .await
    }

    pub async fn check_alerts(&self) -> Result<u32, WorkerError> {
        let rules = self.storage.list_enabled_alert_rules().await?;
        let mut triggered = 0u32;
        let now = OffsetDateTime::now_utc();
        let alert_client = Client::builder()
            .connect_timeout(StdDuration::from_secs(UPSTREAM_CONNECT_TIMEOUT_SECONDS))
            .timeout(StdDuration::from_secs(UPSTREAM_REQUEST_TIMEOUT_SECONDS))
            .pool_idle_timeout(StdDuration::from_secs(UPSTREAM_IDLE_TIMEOUT_SECONDS))
            .build()?;

        for rule in &rules {
            if !should_trigger_alert(rule.last_triggered_at.as_deref(), now) {
                continue;
            }
            let should_fire = match rule.kind {
                AlertRuleKind::AccountDisabled => {
                    let since = sqlite_timestamp(now - Duration::minutes(10));
                    self.storage
                        .count_recently_disabled_accounts(&since)
                        .await?
                        >= rule.threshold_value
                }
                AlertRuleKind::HighErrorRate => {
                    let since = sqlite_timestamp(now - Duration::minutes(5));
                    match self.storage.error_rate_since(&since).await? {
                        Some(rate) => rate > rule.threshold_value as f64,
                        None => false,
                    }
                }
                AlertRuleKind::StaleAsyncJob => {
                    let stale_before =
                        sqlite_timestamp(now - Duration::minutes(rule.threshold_value));
                    self.storage.count_stale_async_jobs(&stale_before).await? > 0
                }
            };

            if !should_fire {
                continue;
            }

            let message = format!(
                "Alert [{}]: {} triggered (kind={}, threshold={})",
                rule.id, rule.name, rule.kind, rule.threshold_value
            );

            let payload = serde_json::json!({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "kind": rule.kind,
                "threshold_value": rule.threshold_value,
                "message": message,
            });

            let mut event_metadata = payload.clone();
            let delivered = match alert_client
                .post(&rule.webhook_url)
                .json(&payload)
                .send()
                .await
            {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        info!(
                            rule_id = rule.id,
                            kind = rule.kind.as_str(),
                            status = status.as_u16(),
                            "alert webhook sent"
                        );
                        merge_metadata(
                            &mut event_metadata,
                            serde_json::json!({
                                "delivery_status": "sent",
                                "delivery_http_status": status.as_u16(),
                            }),
                        );
                        true
                    } else {
                        error!(
                            rule_id = rule.id,
                            kind = rule.kind.as_str(),
                            status = status.as_u16(),
                            "alert webhook returned non-success status"
                        );
                        merge_metadata(
                            &mut event_metadata,
                            serde_json::json!({
                                "delivery_status": "failed",
                                "delivery_http_status": status.as_u16(),
                            }),
                        );
                        false
                    }
                }
                Err(err) => {
                    error!(
                        rule_id = rule.id,
                        kind = rule.kind.as_str(),
                        error = %err,
                        "alert webhook delivery failed"
                    );
                    merge_metadata(
                        &mut event_metadata,
                        serde_json::json!({
                            "delivery_status": "failed",
                            "delivery_error": err.to_string(),
                        }),
                    );
                    false
                }
            };

            if delivered && let Err(err) = self.storage.update_alert_rule_triggered(&rule.id).await
            {
                error!(rule_id = rule.id, error = %err, "failed to update alert rule last_triggered_at");
            }

            if let Err(err) = self
                .storage
                .insert_alert_event(&AlertEventInsert {
                    id: uuid::Uuid::now_v7(),
                    alert_rule_id: Some(rule.id.clone()),
                    kind: rule.kind.as_str().to_owned(),
                    message: message.clone(),
                    metadata: event_metadata,
                })
                .await
            {
                error!(rule_id = rule.id, error = %err, "failed to insert alert event");
            }

            if delivered {
                triggered += 1;
            }
        }

        Ok(triggered)
    }

    async fn reconcile_firecrawl_job(
        &self,
        job: &ProviderAsyncJobRecord,
    ) -> Result<JobProgress, WorkerError> {
        let Some(account_id) = job.provider_account_id.as_deref() else {
            self.defer_job(
                job,
                Some("missing provider account binding".to_owned()),
                FIRECRAWL_RETRY_POLL_DELAY_SECONDS,
            )
            .await?;
            return Ok(JobProgress::Failed);
        };
        let Some(account) = self.storage.find_provider_account(account_id).await? else {
            self.defer_job(
                job,
                Some("provider account not found".to_owned()),
                FIRECRAWL_RETRY_POLL_DELAY_SECONDS,
            )
            .await?;
            return Ok(JobProgress::Failed);
        };
        let egress_proxy = match job.egress_proxy_id.as_deref() {
            Some(proxy_id) => self.storage.find_egress_proxy(proxy_id).await?,
            None => None,
        };
        let egress_mode = if egress_proxy.is_some() {
            "proxy"
        } else {
            "direct"
        };
        let egress_target = egress_proxy
            .as_ref()
            .map(|value| summarize_proxy_url(&value.proxy_url))
            .unwrap_or_else(|| "direct".to_owned());
        let status_path = job
            .metadata
            .get("status_path")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| WorkerError::MissingStatusPath(job.id.clone()))?;
        let url = join_url(account.base_url(), status_path, None);
        let client = self.client_pool.client_for(egress_proxy.as_ref())?;
        let response = client.get(&url).bearer_auth(&account.api_key).send().await;

        let response = match response {
            Ok(response) => response,
            Err(error) => {
                let error_message = error.to_string();
                self.storage
                    .record_provider_account_failure(&account.id, &error_message)
                    .await?;
                if let Some(egress_proxy) = &egress_proxy {
                    self.storage
                        .record_egress_proxy_cooldown(
                            &egress_proxy.id,
                            calculate_cooldown_seconds(egress_proxy.consecutive_failures),
                            &error_message,
                        )
                        .await?;
                }
                self.defer_job(job, Some(error_message), FIRECRAWL_RETRY_POLL_DELAY_SECONDS)
                    .await?;
                return Ok(JobProgress::Failed);
            }
        };
        let status = response.status();
        let body = match response.bytes().await {
            Ok(body) => body,
            Err(error) => {
                let error_message = error.to_string();
                self.storage
                    .record_provider_account_failure(&account.id, &error_message)
                    .await?;
                if let Some(egress_proxy) = &egress_proxy {
                    self.storage
                        .record_egress_proxy_cooldown(
                            &egress_proxy.id,
                            calculate_cooldown_seconds(egress_proxy.consecutive_failures),
                            &error_message,
                        )
                        .await?;
                }
                self.defer_job(job, Some(error_message), FIRECRAWL_RETRY_POLL_DELAY_SECONDS)
                    .await?;
                return Ok(JobProgress::Failed);
            }
        };
        let body_bytes = body.as_ref();

        match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                self.storage
                    .record_provider_account_disabled(
                        &account.id,
                        Some(i64::from(status.as_u16())),
                        Some("firecrawl poll authentication failed"),
                    )
                    .await?;
                self.defer_job(
                    job,
                    Some(format!("firecrawl poll auth failed: {}", status.as_u16())),
                    FIRECRAWL_RETRY_POLL_DELAY_SECONDS,
                )
                .await?;
                return Ok(JobProgress::Failed);
            }
            StatusCode::PAYMENT_REQUIRED | StatusCode::TOO_MANY_REQUESTS => {
                self.storage
                    .record_provider_account_cooldown(
                        &account.id,
                        calculate_cooldown_seconds(account.consecutive_failures),
                        Some(i64::from(status.as_u16())),
                        Some("firecrawl poll rate limited"),
                    )
                    .await?;
                self.defer_job(
                    job,
                    Some(format!("firecrawl poll deferred: {}", status.as_u16())),
                    FIRECRAWL_RETRY_POLL_DELAY_SECONDS,
                )
                .await?;
                return Ok(JobProgress::Failed);
            }
            _ => {}
        }

        if status.is_server_error() {
            let reason = format!("firecrawl poll upstream status {}", status.as_u16());
            self.storage
                .record_provider_account_failure(&account.id, &reason)
                .await?;
            self.defer_job(job, Some(reason), FIRECRAWL_RETRY_POLL_DELAY_SECONDS)
                .await?;
            return Ok(JobProgress::Failed);
        }

        self.storage
            .record_provider_account_success(&account.id, Some(i64::from(status.as_u16())))
            .await?;
        if let Some(egress_proxy) = &egress_proxy {
            self.storage
                .record_egress_proxy_success(&egress_proxy.id)
                .await?;
        }

        let parsed = match parse_async_job_status(body_bytes) {
            Ok(parsed) => parsed,
            Err(error) => {
                let error_message = error.to_string();
                self.defer_job(job, Some(error_message), FIRECRAWL_RETRY_POLL_DELAY_SECONDS)
                    .await?;
                return Ok(JobProgress::Failed);
            }
        };
        let merged_metadata = merge_status_metadata(&job.metadata, &parsed.metadata);

        if parsed.state.is_terminal() {
            self.finalize_job(FinalizeJob {
                job,
                account_id: &account.id,
                status,
                state: parsed.state,
                metadata: merged_metadata,
                egress_mode,
                egress_target: &egress_target,
            })
            .await?;

            return Ok(match parsed.state {
                ProviderAsyncJobState::Completed => JobProgress::Settled,
                ProviderAsyncJobState::Failed | ProviderAsyncJobState::Cancelled => {
                    JobProgress::Failed
                }
                ProviderAsyncJobState::Pending | ProviderAsyncJobState::Running => {
                    JobProgress::Progressed
                }
            });
        }

        self.storage
            .update_provider_async_job(
                &job.id,
                &ProviderAsyncJobUpdate {
                    state: parsed.state,
                    status_code: Some(i64::from(status.as_u16())),
                    last_error: None,
                    poll_attempt_increment: 1,
                    next_poll_at: Some(future_timestamp(FIRECRAWL_DEFAULT_POLL_DELAY_SECONDS)?),
                    settled_at: None,
                    metadata: merged_metadata,
                },
            )
            .await?;

        info!(
            async_job_id = job.id.as_str(),
            provider_account_id = account.id.as_str(),
            egress_mode,
            egress_target,
            upstream_status = status.as_u16(),
            async_state = parsed.state.as_str(),
            "firecrawl async job progressed"
        );

        Ok(JobProgress::Progressed)
    }

    async fn finalize_job(&self, request: FinalizeJob<'_>) -> Result<bool, WorkerError> {
        let claimed = self
            .storage
            .update_provider_async_job(
                &request.job.id,
                &ProviderAsyncJobUpdate {
                    state: request.state,
                    status_code: Some(i64::from(request.status.as_u16())),
                    last_error: None,
                    poll_attempt_increment: 1,
                    next_poll_at: None,
                    settled_at: Some(current_timestamp()?),
                    metadata: request.metadata.clone(),
                },
            )
            .await?;

        if !claimed {
            info!(
                async_job_id = request.job.id.as_str(),
                state = request.state.as_str(),
                "async job already in terminal state, skipping settlement"
            );
            return Ok(false);
        }

        info!(
            async_job_id = request.job.id.as_str(),
            provider_account_id = request.account_id,
            egress_mode = request.egress_mode,
            egress_target = request.egress_target,
            upstream_status = request.status.as_u16(),
            async_state = request.state.as_str(),
            "async job settled"
        );

        Ok(true)
    }

    async fn defer_job(
        &self,
        job: &ProviderAsyncJobRecord,
        last_error: Option<String>,
        next_delay_seconds: i64,
    ) -> Result<(), WorkerError> {
        let metadata = merge_status_metadata(
            &job.metadata,
            &serde_json::json!({
                "last_error": last_error,
            }),
        );
        self.storage
            .update_provider_async_job(
                &job.id,
                &ProviderAsyncJobUpdate {
                    state: ProviderAsyncJobState::Running,
                    status_code: job.last_status_code,
                    last_error,
                    poll_attempt_increment: 1,
                    next_poll_at: Some(future_timestamp(next_delay_seconds)?),
                    settled_at: None,
                    metadata,
                },
            )
            .await?;
        Ok(())
    }
}

#[derive(Clone, Copy)]
enum JobProgress {
    Progressed,
    Settled,
    Failed,
}

fn merge_status_metadata(
    current: &serde_json::Value,
    incoming: &serde_json::Value,
) -> serde_json::Value {
    let mut merged = current.as_object().cloned().unwrap_or_default();
    if let Some(incoming) = incoming.as_object() {
        for (key, value) in incoming {
            merged.insert(key.clone(), value.clone());
        }
    }
    serde_json::Value::Object(merged)
}

fn merge_metadata(current: &mut serde_json::Value, incoming: serde_json::Value) {
    let merged = merge_status_metadata(current, &incoming);
    *current = merged;
}

fn current_timestamp() -> Result<String, WorkerError> {
    Ok(sqlite_timestamp(OffsetDateTime::now_utc()))
}

fn future_timestamp(seconds: i64) -> Result<String, WorkerError> {
    Ok(sqlite_timestamp(
        OffsetDateTime::now_utc() + Duration::seconds(seconds),
    ))
}

fn should_trigger_alert(last_triggered_at: Option<&str>, now: OffsetDateTime) -> bool {
    let Some(last_triggered_at) = last_triggered_at else {
        return true;
    };
    let Some(last_triggered_at) = parse_sqlite_timestamp(last_triggered_at) else {
        return true;
    };
    now - last_triggered_at >= Duration::seconds(ALERT_RETRIGGER_WINDOW_SECONDS)
}

#[derive(Debug, Error)]
pub enum WorkerError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error(transparent)]
    Provider(#[from] wdapm_core::ProviderError),
    #[error("worker client pool is poisoned")]
    ClientPoolPoisoned,
    #[error("firecrawl async job `{0}` is missing status path")]
    MissingStatusPath(String),
}
