create table if not exists tenants (
    id text primary key,
    name text not null unique,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
) strict;

create table if not exists providers (
    id text primary key,
    display_name text not null,
    created_at text not null default current_timestamp
) strict;

create table if not exists platform_api_keys (
    id text primary key,
    tenant_id text not null references tenants(id) on delete cascade,
    name text not null,
    key_hash text not null unique,
    key_prefix text not null,
    encrypted_key text not null,
    quota integer not null default 0,
    request_count integer not null default 0,
    created_at text not null default (datetime('now')),
    revoked_at text
) strict;

create table if not exists provider_accounts (
    id text primary key,
    provider_id text not null references providers(id),
    name text not null,
    enabled integer not null default 1,
    base_url text,
    config text not null default '{}' check (json_valid(config)),
    status text not null default 'active',
    last_error text,
    cooldown_until text,
    last_used_at text,
    consecutive_failures integer not null default 0,
    last_status_code integer,
    weight integer not null default 100,
    last_failure_at text,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
) strict;

create table if not exists provider_account_credentials (
    provider_account_id text primary key references provider_accounts(id) on delete cascade,
    encrypted_api_key text not null,
    updated_at text not null default current_timestamp
) strict;

create table if not exists egress_proxies (
    id text primary key,
    name text not null unique,
    kind text not null default 'http',
    proxy_url text not null,
    region text,
    enabled integer not null default 1,
    status text not null default 'active',
    last_error text,
    cooldown_until text,
    last_used_at text,
    consecutive_failures integer not null default 0,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
) strict;

create table if not exists account_proxy_bindings (
    id text primary key,
    provider_account_id text not null references provider_accounts(id) on delete cascade,
    egress_proxy_id text not null references egress_proxies(id) on delete cascade,
    sticky integer not null default 1,
    created_at text not null default current_timestamp,
    unique (provider_account_id, egress_proxy_id)
) strict;

create table if not exists request_logs (
    id text primary key,
    tenant_id text references tenants(id) on delete set null,
    platform_api_key_id text references platform_api_keys(id) on delete set null,
    provider_id text not null references providers(id),
    provider_account_id text references provider_accounts(id) on delete set null,
    egress_proxy_id text references egress_proxies(id) on delete set null,
    method text not null,
    route text not null,
    upstream_url text not null,
    status_code integer,
    latency_ms integer,
    failure_kind text,
    failure_message text,
    request_headers text not null default '{}' check (json_valid(request_headers)),
    response_headers text not null default '{}' check (json_valid(response_headers)),
    request_body text,
    response_body text,
    created_at text not null default current_timestamp
) strict;

create table if not exists provider_async_jobs (
    id text primary key,
    tenant_id text references tenants(id) on delete set null,
    request_log_id text references request_logs(id) on delete set null,
    provider_id text not null references providers(id),
    provider_account_id text references provider_accounts(id) on delete set null,
    egress_proxy_id text references egress_proxies(id) on delete set null,
    upstream_job_id text not null,
    state text not null,
    route text not null default '/',
    last_status_code integer,
    last_error text,
    poll_attempts integer not null default 0,
    next_poll_at text,
    settled_at text,
    webhook_secret text,
    metadata text not null default '{}' check (json_valid(metadata)),
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
) strict;

create table if not exists admin_audit_logs (
    id text primary key,
    admin_identity text not null,
    action text not null,
    resource_type text not null,
    resource_id text,
    old_value text check (old_value is null or json_valid(old_value)),
    new_value text check (new_value is null or json_valid(new_value)),
    created_at text not null default current_timestamp
) strict;

create table if not exists alert_rules (
    id text primary key,
    name text not null,
    kind text not null,
    threshold_value integer not null,
    webhook_url text not null,
    enabled integer not null default 1,
    last_triggered_at text,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
) strict;

create table if not exists alert_events (
    id text primary key,
    alert_rule_id text references alert_rules(id) on delete set null,
    kind text not null,
    message text not null,
    metadata text not null default '{}' check (json_valid(metadata)),
    created_at text not null default current_timestamp
) strict;

create table if not exists admin_config (
    key text primary key,
    value text not null,
    updated_at text not null default (datetime('now'))
) strict;

create index if not exists idx_provider_accounts_routing
    on provider_accounts (provider_id, enabled, status, cooldown_until, last_used_at);

create index if not exists idx_request_logs_provider_created_at
    on request_logs (provider_id, created_at desc);

create index if not exists idx_request_logs_provider_account_created_at
    on request_logs (provider_account_id, created_at desc);

create index if not exists idx_egress_proxies_runtime
    on egress_proxies (enabled, status, cooldown_until, kind, last_used_at);

create index if not exists idx_account_proxy_bindings_account
    on account_proxy_bindings (provider_account_id, created_at desc);

create index if not exists idx_request_logs_egress_proxy_created_at
    on request_logs (egress_proxy_id, created_at desc);

create index if not exists idx_provider_async_jobs_due
    on provider_async_jobs (provider_id, state, next_poll_at, updated_at);

create unique index if not exists idx_provider_async_jobs_upstream
    on provider_async_jobs (provider_id, upstream_job_id);

create index if not exists idx_admin_audit_logs_created
    on admin_audit_logs (created_at desc);

create index if not exists idx_provider_async_jobs_webhook_secret
    on provider_async_jobs (webhook_secret)
    where webhook_secret is not null;

create index if not exists idx_request_logs_platform_api_key_created_at
    on request_logs (platform_api_key_id, created_at desc);

create index if not exists idx_request_logs_created_at_id
    on request_logs (created_at desc, id desc);

insert or ignore into providers (id, display_name) values
    ('exa', 'Exa'),
    ('tavily', 'Tavily'),
    ('firecrawl', 'Firecrawl'),
    ('jina', 'Jina');
