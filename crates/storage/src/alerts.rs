use crate::{StorageError, StorageService, bool_to_int, map_alert_event, map_alert_rule};
use wdapm_core::{
    AlertEventInsert, AlertEventRecord, AlertRuleInsert, AlertRuleKind, AlertRuleRecord,
};

impl StorageService {
    pub async fn insert_alert_rule(&self, rule: &AlertRuleInsert) -> Result<(), StorageError> {
        sqlx::query(
            r#"
        insert into alert_rules (id, name, kind, threshold_value, webhook_url, enabled)
        values (?, ?, ?, ?, ?, ?)
        "#,
        )
        .bind(rule.id.to_string())
        .bind(&rule.name)
        .bind(rule.kind.as_str())
        .bind(rule.threshold_value)
        .bind(&rule.webhook_url)
        .bind(bool_to_int(rule.enabled))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_alert_rule(
        &self,
        id: &str,
        name: &str,
        kind: AlertRuleKind,
        threshold_value: i64,
        webhook_url: &str,
        enabled: bool,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query(
            r#"
        update alert_rules
        set name = ?, kind = ?, threshold_value = ?, webhook_url = ?,
            enabled = ?, updated_at = current_timestamp
        where id = ?
        "#,
        )
        .bind(name)
        .bind(kind.as_str())
        .bind(threshold_value)
        .bind(webhook_url)
        .bind(bool_to_int(enabled))
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn list_alert_rules(&self) -> Result<Vec<AlertRuleRecord>, StorageError> {
        let rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
            r#"
        select id, name, kind, threshold_value, webhook_url, enabled,
               last_triggered_at, created_at, updated_at
        from alert_rules
        order by created_at desc
        "#,
        )
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter().map(map_alert_rule).collect()
    }

    pub async fn find_alert_rule(&self, id: &str) -> Result<Option<AlertRuleRecord>, StorageError> {
        let row: Option<sqlx::sqlite::SqliteRow> = sqlx::query(
            r#"
        select id, name, kind, threshold_value, webhook_url, enabled,
               last_triggered_at, created_at, updated_at
        from alert_rules where id = ?
        "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        row.map(map_alert_rule).transpose()
    }

    pub async fn delete_alert_rule(&self, id: &str) -> Result<bool, StorageError> {
        let result = sqlx::query("delete from alert_rules where id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn list_enabled_alert_rules(&self) -> Result<Vec<AlertRuleRecord>, StorageError> {
        let rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
            r#"
        select id, name, kind, threshold_value, webhook_url, enabled,
               last_triggered_at, created_at, updated_at
        from alert_rules where enabled = 1
        "#,
        )
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter().map(map_alert_rule).collect()
    }

    pub async fn update_alert_rule_triggered(&self, id: &str) -> Result<(), StorageError> {
        sqlx::query(
        "update alert_rules set last_triggered_at = current_timestamp, updated_at = current_timestamp where id = ?",
    )
    .bind(id)
    .execute(&self.pool)
    .await?;
        Ok(())
    }

    pub async fn insert_alert_event(&self, event: &AlertEventInsert) -> Result<(), StorageError> {
        sqlx::query(
            r#"
        insert into alert_events (id, alert_rule_id, kind, message, metadata)
        values (?, ?, ?, ?, ?)
        "#,
        )
        .bind(event.id.to_string())
        .bind(event.alert_rule_id.as_deref())
        .bind(&event.kind)
        .bind(&event.message)
        .bind(event.metadata.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_alert_events(
        &self,
        since: Option<&str>,
        until: Option<&str>,
        kind: Option<&str>,
        limit: i64,
    ) -> Result<Vec<AlertEventRecord>, StorageError> {
        let rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
            r#"
        select id, alert_rule_id, kind, message, metadata, created_at
        from alert_events
        where (? is null or created_at >= ?)
          and (? is null or created_at <= ?)
          and (? is null or kind = ?)
        order by created_at desc
        limit ?
        "#,
        )
        .bind(since)
        .bind(since)
        .bind(until)
        .bind(until)
        .bind(kind)
        .bind(kind)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter().map(map_alert_event).collect()
    }
}
