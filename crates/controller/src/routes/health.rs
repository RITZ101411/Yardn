use axum::{Router, http::StatusCode, routing::get};

use crate::app::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/health", get(health))
}

pub async fn health() -> StatusCode {
    StatusCode::OK
}
