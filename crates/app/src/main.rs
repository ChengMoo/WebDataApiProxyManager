use std::env;
use std::net::SocketAddr;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::http::HeaderValue;
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, get_service};
use rand::RngExt;
use tokio::time::{self, MissedTickBehavior};
use tower_http::compression::CompressionLayer;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;
use wdapm_admin_api::{AdminApiState, build_router as build_admin_router};
use wdapm_gateway::{
    GatewayConfig, GatewayState, ProviderRegistry, RequestLogCaptureConfig, RequestLogCaptureMode,
    build_router as build_gateway_router,
};
use wdapm_scheduler::SchedulerService;
use wdapm_storage::{SqliteTuning, StorageService};
use wdapm_worker::WorkerService;

#[derive(Clone)]
struct SqliteMaintenanceConfig {
    optimize_interval_seconds: u64,
    checkpoint_interval_seconds: u64,
    checkpoint_threshold_bytes: i64,
    truncate_interval_seconds: u64,
    incremental_vacuum_pages: i64,
}

#[derive(Clone)]
struct RequestLogMaintenanceConfig {
    archive_enabled: bool,
    archive_dir: PathBuf,
    hot_retention_hours: i64,
    archive_retention_days: i64,
    archive_interval_seconds: u64,
    archive_batch_size: i64,
    archive_max_bytes: u64,
}

#[derive(Clone)]
struct FrontendAssets {
    root: Option<PathBuf>,
    index_html: Option<Bytes>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();

    let bind_addr = env::var("WDAPM_BIND_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:3000".to_owned())
        .parse::<SocketAddr>()?;
    let database_url =
        env::var("WDAPM_DATABASE_URL").unwrap_or_else(|_| "sqlite://wdapm.db".to_owned());
    let webhook_base_url = env::var("WDAPM_WEBHOOK_BASE_URL")
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let worker_enabled = env_flag("WDAPM_WORKER_ENABLED", true);
    let worker_firecrawl_interval_seconds = env_u64("WDAPM_WORKER_FIRECRAWL_INTERVAL_SECONDS", 30);
    let worker_firecrawl_batch_limit = env_i64("WDAPM_WORKER_FIRECRAWL_BATCH_LIMIT", 50);
    let alert_check_interval_seconds = env_u64("WDAPM_ALERT_CHECK_INTERVAL_SECONDS", 300);
    let sqlite_tuning = SqliteTuning {
        max_connections: env_u32("WDAPM_SQLITE_MAX_CONNECTIONS", 8),
        busy_timeout: std::time::Duration::from_millis(env_u64(
            "WDAPM_SQLITE_BUSY_TIMEOUT_MS",
            15_000,
        )),
        cache_size_kib: env_i64("WDAPM_SQLITE_CACHE_SIZE_KIB", 16 * 1024),
        mmap_size_bytes: i64::try_from(
            env_u64("WDAPM_SQLITE_MMAP_SIZE_MB", 256).saturating_mul(1024 * 1024),
        )
        .unwrap_or(256 * 1024 * 1024),
        journal_size_limit_bytes: i64::try_from(
            env_u64("WDAPM_SQLITE_JOURNAL_SIZE_LIMIT_MB", 64).saturating_mul(1024 * 1024),
        )
        .unwrap_or(64 * 1024 * 1024),
    };
    let sqlite_maintenance = SqliteMaintenanceConfig {
        optimize_interval_seconds: env_u64("WDAPM_SQLITE_OPTIMIZE_INTERVAL_SECONDS", 21_600),
        checkpoint_interval_seconds: env_u64("WDAPM_SQLITE_CHECKPOINT_INTERVAL_SECONDS", 60),
        checkpoint_threshold_bytes: i64::try_from(
            env_u64("WDAPM_SQLITE_CHECKPOINT_WAL_MB", 64).saturating_mul(1024 * 1024),
        )
        .unwrap_or(64 * 1024 * 1024),
        truncate_interval_seconds: env_u64(
            "WDAPM_SQLITE_CHECKPOINT_TRUNCATE_INTERVAL_SECONDS",
            1_800,
        ),
        incremental_vacuum_pages: env_i64("WDAPM_SQLITE_INCREMENTAL_VACUUM_PAGES", 256),
    };
    let gateway_config = GatewayConfig {
        request_log_capture: RequestLogCaptureConfig {
            mode: env_request_log_capture_mode("WDAPM_REQUEST_LOG_CAPTURE_MODE"),
            body_max_bytes: env_usize("WDAPM_REQUEST_LOG_BODY_MAX_BYTES", 8 * 1024),
            slow_request_threshold_ms: env_u64("WDAPM_REQUEST_LOG_SLOW_MS", 2_000),
        },
        request_log_writer_capacity: env_usize("WDAPM_REQUEST_LOG_QUEUE_CAPACITY", 4_096),
    };
    let request_log_maintenance = RequestLogMaintenanceConfig {
        archive_enabled: env_flag("WDAPM_REQUEST_LOG_ARCHIVE_ENABLED", true),
        archive_dir: env_path("WDAPM_REQUEST_LOG_ARCHIVE_DIR")
            .unwrap_or_else(|| default_archive_dir(&database_url)),
        hot_retention_hours: env_i64("WDAPM_REQUEST_LOG_HOT_RETENTION_HOURS", 168),
        archive_retention_days: env_i64("WDAPM_REQUEST_LOG_ARCHIVE_RETENTION_DAYS", 90),
        archive_interval_seconds: env_u64("WDAPM_REQUEST_LOG_ARCHIVE_INTERVAL_SECONDS", 300),
        archive_batch_size: env_i64("WDAPM_REQUEST_LOG_ARCHIVE_BATCH_SIZE", 5_000),
        archive_max_bytes: env_u64("WDAPM_REQUEST_LOG_ARCHIVE_MAX_BYTES", 0),
    };
    let master_key = resolve_master_key(&database_url)?;
    let storage = Arc::new(
        StorageService::connect_with_keys_and_tuning(&database_url, master_key, sqlite_tuning)
            .await?,
    );
    let worker = Arc::new(WorkerService::new(storage.clone()));
    let scheduler = Arc::new(SchedulerService::new());
    let frontend_assets = FrontendAssets::discover();
    let provider_registry = ProviderRegistry::builder()
        .register(wdapm_provider_exa::adapter())
        .register(wdapm_provider_tavily::adapter())
        .register(wdapm_provider_firecrawl::adapter())
        .register(wdapm_provider_jina::adapter())
        .build();
    let gateway_state = GatewayState::new(
        "default".to_owned(),
        provider_registry,
        storage.clone(),
        scheduler,
        worker.clone(),
        webhook_base_url,
        gateway_config,
    );
    let admin_state = AdminApiState::new("default".to_owned(), storage.clone(), worker.clone());
    let app = Router::new()
        .nest("/admin", build_admin_router(admin_state))
        .merge(build_gateway_router(gateway_state))
        .merge(build_frontend_router(frontend_assets))
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ));
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;

    spawn_sqlite_maintenance(storage.clone(), sqlite_maintenance);
    spawn_request_log_maintenance(storage.clone(), request_log_maintenance);

    if worker_enabled {
        spawn_firecrawl_reconciler(
            worker.clone(),
            worker_firecrawl_interval_seconds,
            worker_firecrawl_batch_limit,
        );
        spawn_alert_checker(worker.clone(), alert_check_interval_seconds);
    } else {
        info!("background worker disabled by configuration");
    }

    info!(bind_addr = %bind_addr, "starting gateway");
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();
}

include!("frontend.rs");

fn resolve_master_key(database_url: &str) -> Result<[u8; 32], Box<dyn std::error::Error>> {
    if let Some(key) = parse_hex_key("WDAPM_MASTER_KEY") {
        info!("using master key from WDAPM_MASTER_KEY environment variable");
        return Ok(key);
    }

    let db_dir = database_url
        .strip_prefix("sqlite://")
        .and_then(|path| {
            PathBuf::from(path)
                .parent()
                .map(|parent| parent.to_path_buf())
        })
        .unwrap_or_else(|| PathBuf::from("."));
    let key_file = db_dir.join(".wdapm_master_key");

    if key_file.exists() {
        let hex_str = std::fs::read_to_string(&key_file)?.trim().to_owned();
        let bytes = hex::decode(&hex_str)
            .map_err(|_| format!("invalid hex in master key file: {}", key_file.display()))?;
        let key: [u8; 32] = bytes.try_into().map_err(|value: Vec<u8>| {
            format!(
                "master key file must contain exactly 32 bytes (64 hex chars), got {} bytes",
                value.len()
            )
        })?;
        info!(path = %key_file.display(), "loaded persisted master key");
        return Ok(key);
    }

    let key: [u8; 32] = rand::rng().random();
    let hex_str = hex::encode(key);
    std::fs::write(&key_file, &hex_str)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&key_file, std::fs::Permissions::from_mode(0o600))?;
    }
    info!(path = %key_file.display(), "generated and persisted master key");
    Ok(key)
}

fn parse_hex_key(env_name: &str) -> Option<[u8; 32]> {
    let hex_val = env::var(env_name).ok()?;
    let hex_val = hex_val.trim();
    if hex_val.is_empty() {
        return None;
    }
    let bytes = hex::decode(hex_val).unwrap_or_else(|_| {
        panic!("{env_name} must be valid hex (64 hex chars = 32 bytes)");
    });
    let key: [u8; 32] = bytes.try_into().unwrap_or_else(|v: Vec<u8>| {
        panic!(
            "{env_name} must be exactly 32 bytes (64 hex chars), got {} bytes",
            v.len()
        );
    });
    Some(key)
}

fn env_flag(name: &str, default: bool) -> bool {
    env::var(name)
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn env_i64(name: &str, default: i64) -> i64 {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn env_u32(name: &str, default: u32) -> u32 {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<u32>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn env_usize(name: &str, default: usize) -> usize {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn env_path(name: &str) -> Option<PathBuf> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn env_request_log_capture_mode(name: &str) -> RequestLogCaptureMode {
    match env::var(name)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("metadata_only") => RequestLogCaptureMode::MetadataOnly,
        Some("failures_only") => RequestLogCaptureMode::FailuresOnly,
        _ => RequestLogCaptureMode::FailuresAndSlow,
    }
}

fn default_archive_dir(database_url: &str) -> PathBuf {
    database_url
        .strip_prefix("sqlite://")
        .and_then(|path| {
            PathBuf::from(path)
                .parent()
                .map(|value| value.join("archive"))
        })
        .unwrap_or_else(|| PathBuf::from("archive"))
}

include!("background.rs");
