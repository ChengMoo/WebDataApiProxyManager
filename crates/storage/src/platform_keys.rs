use crate::{
    PlatformApiKeyInsert, StorageError, StorageService, decrypt_credential, encrypt_credential,
};
use sqlx::Row;
use tracing::info;
use wdapm_core::PlatformApiKeyRecord;

impl StorageService {
    pub async fn get_admin_config(&self, key: &str) -> Result<Option<String>, StorageError> {
        let row = sqlx::query("select value from admin_config where key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.get::<String, _>("value")))
    }

    pub async fn set_admin_config(&self, key: &str, value: &str) -> Result<(), StorageError> {
        sqlx::query(
        "insert into admin_config (key, value, updated_at) values (?, ?, datetime('now')) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .execute(&self.pool)
    .await?;
        Ok(())
    }

    pub async fn set_admin_session(
        &self,
        token_hash: &str,
        expires_at: &str,
    ) -> Result<(), StorageError> {
        let mut transaction = self.pool.begin().await?;

        for (key, value) in [
            ("session_token_hash", token_hash),
            ("session_expires_at", expires_at),
        ] {
            sqlx::query(
            "insert into admin_config (key, value, updated_at) values (?, ?, datetime('now')) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(value)
        .execute(&mut *transaction)
        .await?;
        }

        transaction.commit().await?;
        Ok(())
    }

    pub async fn insert_platform_api_key(
        &self,
        key: PlatformApiKeyInsert<'_>,
    ) -> Result<(), StorageError> {
        let encrypted_key = encrypt_credential(key.plaintext_key, &self.master_key);
        sqlx::query(
        r#"
        insert into platform_api_keys (id, tenant_id, name, key_hash, key_prefix, encrypted_key, quota)
        values (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(key.id)
    .bind(key.tenant_id)
    .bind(key.name)
    .bind(key.key_hash)
    .bind(key.key_prefix)
    .bind(encrypted_key)
    .bind(key.quota)
    .execute(&self.pool)
    .await?;
        info!(
            platform_api_key_id = key.id,
            name = key.name,
            "platform api key created"
        );
        Ok(())
    }

    pub async fn list_platform_api_keys(
        &self,
        tenant_id: &str,
    ) -> Result<Vec<PlatformApiKeyRecord>, StorageError> {
        let rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
            r#"
        select id, name, key_prefix, quota, request_count, created_at, revoked_at
        from platform_api_keys
        where tenant_id = ? and revoked_at is null
        order by created_at desc
        "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter()
            .map(|row| {
                Ok(PlatformApiKeyRecord {
                    id: row.try_get("id")?,
                    name: row.try_get("name")?,
                    key_prefix: row.try_get("key_prefix")?,
                    quota: row.try_get("quota")?,
                    request_count: row.try_get("request_count")?,
                    created_at: row.try_get("created_at")?,
                    revoked_at: row.try_get("revoked_at")?,
                })
            })
            .collect()
    }

    pub async fn find_platform_api_key_by_hash(
        &self,
        key_hash: &str,
    ) -> Result<Option<PlatformApiKeyRecord>, StorageError> {
        let row = sqlx::query(
            r#"
        select id, name, key_prefix, quota, request_count, created_at, revoked_at
        from platform_api_keys
        where key_hash = ? and revoked_at is null
        "#,
        )
        .bind(key_hash)
        .fetch_optional(&self.pool)
        .await?;
        row.map(|row| {
            Ok(PlatformApiKeyRecord {
                id: row.try_get("id")?,
                name: row.try_get("name")?,
                key_prefix: row.try_get("key_prefix")?,
                quota: row.try_get("quota")?,
                request_count: row.try_get("request_count")?,
                created_at: row.try_get("created_at")?,
                revoked_at: row.try_get("revoked_at")?,
            })
        })
        .transpose()
    }

    pub async fn get_platform_api_key_secret(
        &self,
        key_id: &str,
    ) -> Result<Option<String>, StorageError> {
        let row = sqlx::query(
            r#"
        select encrypted_key
        from platform_api_keys
        where id = ? and revoked_at is null
        "#,
        )
        .bind(key_id)
        .fetch_optional(&self.pool)
        .await?;

        row.map(|row| {
            let encrypted_key: String = row.try_get("encrypted_key")?;
            decrypt_credential(encrypted_key.as_str(), &self.master_key)
        })
        .transpose()
    }

    pub async fn update_platform_api_key(
        &self,
        key_id: &str,
        name: &str,
        quota: i64,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query(
            r#"
        update platform_api_keys
        set name = ?, quota = ?
        where id = ? and revoked_at is null
        "#,
        )
        .bind(name)
        .bind(quota)
        .bind(key_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn revoke_platform_api_key(&self, key_id: &str) -> Result<bool, StorageError> {
        let result = sqlx::query(
            r#"
        update platform_api_keys
        set revoked_at = datetime('now')
        where id = ? and revoked_at is null
        "#,
        )
        .bind(key_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn increment_platform_api_key_counter(
        &self,
        key_id: &str,
    ) -> Result<bool, StorageError> {
        let result = sqlx::query(
            r#"
        update platform_api_keys
        set request_count = request_count + 1
        where id = ? and revoked_at is null
          and (quota = 0 or request_count < quota)
        "#,
        )
        .bind(key_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }
}
