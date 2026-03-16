#[derive(Clone, Default)]
struct ClientPool {
    clients: Arc<RwLock<HashMap<String, Client>>>,
}

impl ClientPool {
    fn client_for(&self, egress_proxy: Option<&EgressProxy>) -> Result<Client, GatewayError> {
        let key = egress_proxy
            .map(|value| value.proxy_url.clone())
            .unwrap_or_else(|| "__direct__".to_owned());
        if let Some(client) = self
            .clients
            .read()
            .map_err(|_| GatewayError::ClientPoolPoisoned)?
            .get(&key)
            .cloned()
        {
            return Ok(client);
        }

        let mut builder = Client::builder()
            .connect_timeout(Duration::from_secs(UPSTREAM_CONNECT_TIMEOUT_SECONDS))
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(UPSTREAM_REQUEST_TIMEOUT_SECONDS))
            .no_gzip()
            .no_brotli()
            .no_deflate()
            .no_zstd()
            .pool_idle_timeout(Duration::from_secs(UPSTREAM_IDLE_TIMEOUT_SECONDS));
        if let Some(egress_proxy) = egress_proxy {
            builder = builder.proxy(Proxy::all(&egress_proxy.proxy_url)?);
        }
        let client = builder.build()?;
        let mut clients = self
            .clients
            .write()
            .map_err(|_| GatewayError::ClientPoolPoisoned)?;
        if let Some(existing) = clients.get(&key).cloned() {
            Ok(existing)
        } else {
            clients.insert(key, client.clone());
            Ok(client)
        }
    }
}
