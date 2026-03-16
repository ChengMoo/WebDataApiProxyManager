fn spawn_firecrawl_reconciler(worker: Arc<WorkerService>, interval_seconds: u64, batch_limit: i64) {
    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(interval_seconds));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        info!(interval_seconds, batch_limit, "background firecrawl reconciler started");

        loop {
            interval.tick().await;

            match worker.reconcile_firecrawl_jobs(batch_limit).await {
                Ok(report) => {
                    info!(
                        scanned = report.scanned,
                        progressed = report.progressed,
                        settled = report.settled,
                        failed = report.failed,
                        "background firecrawl reconciliation tick completed"
                    );
                }
                Err(error) => {
                    tracing::error!(%error, "background firecrawl reconciliation tick failed");
                }
            }
        }
    });
}

fn spawn_sqlite_maintenance(storage: Arc<StorageService>, config: SqliteMaintenanceConfig) {
    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(
            config.checkpoint_interval_seconds,
        ));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
        let mut last_optimize = Instant::now();
        let mut last_truncate = Instant::now();
        let page_size = match storage.sqlite_page_size().await {
            Ok(value) => value,
            Err(error) => {
                warn!(error = %error, "failed to read sqlite page_size, using default");
                4096
            }
        };

        info!(
            checkpoint_interval_seconds = config.checkpoint_interval_seconds,
            checkpoint_threshold_bytes = config.checkpoint_threshold_bytes,
            truncate_interval_seconds = config.truncate_interval_seconds,
            optimize_interval_seconds = config.optimize_interval_seconds,
            "sqlite maintenance started"
        );

        loop {
            interval.tick().await;

            if last_optimize.elapsed().as_secs() >= config.optimize_interval_seconds {
                match storage.run_sqlite_optimize().await {
                    Ok(()) => {
                        info!("sqlite optimize completed");
                        last_optimize = Instant::now();
                    }
                    Err(error) => {
                        warn!(error = %error, "sqlite optimize failed");
                    }
                }
            }

            match storage.sqlite_checkpoint_noop().await {
                Ok(Some(stats))
                    if stats.wal_bytes(page_size) >= config.checkpoint_threshold_bytes =>
                {
                    match storage.run_sqlite_checkpoint_passive().await {
                        Ok(applied) => {
                            info!(
                                busy = applied.busy,
                                log_frames = applied.log_frames,
                                checkpointed_frames = applied.checkpointed_frames,
                                wal_bytes = stats.wal_bytes(page_size),
                                "sqlite passive checkpoint completed"
                            );
                        }
                        Err(error) => {
                            warn!(error = %error, "sqlite passive checkpoint failed");
                        }
                    }
                }
                Ok(Some(_)) => {}
                Ok(None) => {
                    if let Err(error) = storage.run_sqlite_checkpoint_passive().await {
                        warn!(error = %error, "sqlite passive checkpoint fallback failed");
                    }
                }
                Err(error) => {
                    warn!(error = %error, "sqlite checkpoint probe failed");
                }
            }

            if last_truncate.elapsed().as_secs() >= config.truncate_interval_seconds {
                match storage.run_sqlite_checkpoint_truncate().await {
                    Ok(stats) => {
                        info!(
                            busy = stats.busy,
                            log_frames = stats.log_frames,
                            checkpointed_frames = stats.checkpointed_frames,
                            "sqlite truncate checkpoint completed"
                        );
                    }
                    Err(error) => {
                        warn!(error = %error, "sqlite truncate checkpoint failed");
                    }
                }
                if let Err(error) = storage
                    .run_sqlite_incremental_vacuum(config.incremental_vacuum_pages)
                    .await
                {
                    warn!(error = %error, "sqlite incremental vacuum failed");
                }
                last_truncate = Instant::now();
            }
        }
    });
}

fn spawn_request_log_maintenance(
    storage: Arc<StorageService>,
    config: RequestLogMaintenanceConfig,
) {
    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(
            config.archive_interval_seconds,
        ));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        info!(
            archive_enabled = config.archive_enabled,
            archive_dir = %config.archive_dir.display(),
            hot_retention_hours = config.hot_retention_hours,
            archive_retention_days = config.archive_retention_days,
            archive_batch_size = config.archive_batch_size,
            archive_max_bytes = config.archive_max_bytes,
            "request log maintenance started"
        );

        loop {
            interval.tick().await;

            if config.archive_enabled {
                match storage
                    .archive_request_logs_older_than_hours(
                        &config.archive_dir,
                        config.hot_retention_hours,
                        config.archive_batch_size,
                    )
                    .await
                {
                    Ok(report) if report.archived_rows > 0 => {
                        info!(
                            archived_rows = report.archived_rows,
                            deleted_rows = report.deleted_rows,
                            months = ?report.months,
                            "request logs archived"
                        );
                    }
                    Ok(_) => {}
                    Err(error) => {
                        warn!(error = %error, "request log archiving failed");
                    }
                }
            } else {
                match storage
                    .prune_request_logs_older_than_hours(
                        config.hot_retention_hours,
                        config.archive_batch_size,
                    )
                    .await
                {
                    Ok(deleted) if deleted > 0 => {
                        info!(deleted, "request logs pruned from hot database");
                    }
                    Ok(_) => {}
                    Err(error) => {
                        warn!(error = %error, "request log pruning failed");
                    }
                }
            }

            if let Err(error) = prune_archive_files(
                &config.archive_dir,
                config.archive_retention_days,
                config.archive_max_bytes,
            ) {
                warn!(error = %error, "archive file pruning failed");
            }
        }
    });
}

fn prune_archive_files(
    archive_dir: &Path,
    archive_retention_days: i64,
    archive_max_bytes: u64,
) -> Result<(), std::io::Error> {
    if !archive_dir.is_dir() {
        return Ok(());
    }

    let mut files = std::fs::read_dir(archive_dir)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?.to_owned();
            if !name.starts_with("request-logs-") || !name.ends_with(".sqlite3") {
                return None;
            }
            let month = name
                .strip_prefix("request-logs-")?
                .strip_suffix(".sqlite3")?
                .to_owned();
            let metadata = entry.metadata().ok()?;
            Some((month, path, metadata.len()))
        })
        .collect::<Vec<_>>();

    files.sort_by(|left, right| left.0.cmp(&right.0));
    let cutoff_month = archive_cutoff_month(archive_retention_days);
    let mut total_bytes = files.iter().map(|(_, _, size)| *size).sum::<u64>();

    for (month, path, size) in &files {
        let expired = cutoff_month
            .as_deref()
            .map(|cutoff| month.as_str() < cutoff)
            .unwrap_or(false);
        if expired || (archive_max_bytes > 0 && total_bytes > archive_max_bytes) {
            std::fs::remove_file(path)?;
            let wal_path = PathBuf::from(format!("{}-wal", path.display()));
            if wal_path.exists() {
                let _ = std::fs::remove_file(wal_path);
            }
            let shm_path = PathBuf::from(format!("{}-shm", path.display()));
            if shm_path.exists() {
                let _ = std::fs::remove_file(shm_path);
            }
            total_bytes = total_bytes.saturating_sub(*size);
        }
    }

    Ok(())
}

fn archive_cutoff_month(retention_days: i64) -> Option<String> {
    if retention_days <= 0 {
        return None;
    }

    let now = std::time::SystemTime::now();
    let cutoff = now.checked_sub(std::time::Duration::from_secs(
        u64::try_from(retention_days).ok()?.saturating_mul(86_400),
    ))?;
    let datetime = cutoff.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
    let days = datetime / 86_400;
    let z = i64::try_from(days).ok()? + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let month = mp + if mp < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    Some(format!("{year:04}-{month:02}"))
}

fn spawn_alert_checker(worker: Arc<WorkerService>, interval_seconds: u64) {
    tokio::spawn(async move {
        let mut interval = time::interval(std::time::Duration::from_secs(interval_seconds));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        info!(interval_seconds, "background alert checker started");

        loop {
            interval.tick().await;

            match worker.check_alerts().await {
                Ok(triggered) => {
                    if triggered > 0 {
                        info!(triggered, "alert check tick completed");
                    }
                }
                Err(error) => {
                    tracing::error!(%error, "alert check tick failed");
                }
            }
        }
    });
}
