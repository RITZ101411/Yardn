mod app;
mod k8s;
mod routes;

use app::AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "controller=debug".parse().unwrap()),
        )
        .init();

    // BASE_DOMAIN is required (fail fast). Apps are exposed at <name>.<BASE_DOMAIN>.
    let base_domain = std::env::var("BASE_DOMAIN")
        .expect("BASE_DOMAIN must be set (e.g. localtest.me)");

    let client = kube::Client::try_default()
        .await
        .expect("failed to create kube client");

    let state = AppState {
        client,
        base_domain,
    };

    let app = app::create(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    tracing::info!("listening on {}", listener.local_addr().unwrap());

    axum::serve(listener, app).await.unwrap();
}
