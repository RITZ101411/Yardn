use axum::Router;
use kube::Client;
use tower_http::trace::TraceLayer;

use crate::routes;

#[derive(Clone)]
pub struct AppState {
    pub client: Client,
    pub base_domain: String,
}

pub fn create(state: AppState) -> Router {
    routes::router()
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
