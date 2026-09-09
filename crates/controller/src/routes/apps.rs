use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::k8s::deployment::create_app_deployment;
use crate::k8s::ingressroute::create_app_ingressroute;
use crate::k8s::service::create_app_service;

#[derive(Debug, Deserialize)]
pub struct CreateAppRequest {
    pub name: String,
    pub image: String,
    #[serde(default = "default_port")]
    pub port: i32,
}

fn default_port() -> i32 {
    80
}

#[derive(Debug, Serialize)]
pub struct CreateAppResponse {
    pub name: String,
    pub status: String,
    pub url: String,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/apps", post(create_app))
}

async fn create_app(
    State(state): State<AppState>,
    Json(req): Json<CreateAppRequest>,
) -> impl IntoResponse {
    let AppState {
        client,
        base_domain,
    } = state;

    // 1. Deployment
    if let Err(e) = create_app_deployment(client.clone(), &req.name, &req.image, req.port).await {
        return internal_error("deployment", e);
    }
    // 2. Service
    if let Err(e) = create_app_service(client.clone(), &req.name, req.port).await {
        return internal_error("service", e);
    }
    // 3. IngressRoute
    if let Err(e) = create_app_ingressroute(client, &req.name, req.port, &base_domain).await {
        return internal_error("ingressroute", e);
    }

    let url = format!("http://{}.{}", req.name, base_domain);
    (
        StatusCode::CREATED,
        Json(CreateAppResponse {
            name: req.name,
            status: "created".to_string(),
            url,
        }),
    )
        .into_response()
}

fn internal_error(resource: &str, e: kube::Error) -> axum::response::Response {
    tracing::error!("failed to create {resource}: {e}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": format!("failed to create {resource}: {e}") })),
    )
        .into_response()
}
