FROM oven/bun:1 AS frontend
WORKDIR /build
COPY crates/web/app/package.json crates/web/app/bun.lock ./
RUN bun install --frozen-lockfile
COPY crates/web/app/ ./
RUN bun run build

FROM rust:1-bookworm AS backend
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY crates/admin-api/ crates/admin-api/
COPY crates/app/ crates/app/
COPY crates/core/ crates/core/
COPY crates/gateway/ crates/gateway/
COPY crates/providers/ crates/providers/
COPY crates/scheduler/ crates/scheduler/
COPY crates/storage/ crates/storage/
COPY crates/worker/ crates/worker/
COPY db/ db/
RUN cargo build --release --bin wdapm-app

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=frontend /build/dist /srv/www
COPY --from=backend /build/target/release/wdapm-app /usr/local/bin/wdapm-app

EXPOSE 3000
ENV WDAPM_BIND_ADDR=0.0.0.0:3000
ENV WDAPM_DATABASE_URL=sqlite:///data/wdapm.db

VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/wdapm-app"]
