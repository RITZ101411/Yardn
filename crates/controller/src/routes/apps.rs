use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{post, put},
};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::k8s::deployment::{create_app_deployment, delete_app_deployment, update_app_deployment};
use crate::k8s::ingressroute::{create_app_ingressroute, delete_app_ingressroute};
use crate::k8s::service::{create_app_service, delete_app_service};

#[derive(Debug, Deserialize)]
pub struct CreateAppRequest {
    pub name: String,
    pub image: String,
    #[serde(default = "default_port")]
    pub port: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppRequest {
    pub image: String,
    #[serde(default = "default_port")]
    pub port: i32,
}

fn default_port() -> i32 {
    80
}

#[derive(Debug, Serialize)]
pub struct AppResponse {
    pub name: String,
    pub status: String,
    pub url: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/apps", post(create_app))
        .route("/apps/{name}", put(update_app).delete(delete_app))
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
        Json(AppResponse {
            name: req.name,
            status: "created".to_string(),
            url,
        }),
    )
        .into_response()
}

async fn update_app(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(req): Json<UpdateAppRequest>,
) -> impl IntoResponse {
    let AppState {
        client,
        base_domain,
    } = state;

    match update_app_deployment(client, &name, &req.image, req.port).await {
        Ok(Some(_)) => {
            let url = format!("http://{}.{}", name, base_domain);
            (
                StatusCode::OK,
                Json(AppResponse {
                    name,
                    status: "updated".to_string(),
                    url,
                }),
            )
                .into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": format!("app '{name}' not found") })),
        )
            .into_response(),
        Err(e) => internal_error("deployment", e),
    }
}

async fn delete_app(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let AppState { client, .. } = state;

    match delete_app_deployment(client.clone(), &name).await {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": format!("app '{name}' not found") })),
            )
                .into_response();
        }
        Err(e) => return internal_error("deployment", e),
        Ok(true) => {}
    }

    if let Err(e) = delete_app_service(client.clone(), &name).await {
        return internal_error("service", e);
    }
    if let Err(e) = delete_app_ingressroute(client, &name).await {
        return internal_error("ingressroute", e);
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({ "name": name, "status": "deleted" })),
    )
        .into_response()
}

fn internal_error(resource: &str, e: kube::Error) -> axum::response::Response {
    tracing::error!("failed to update/create {resource}: {e}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": format!("failed to process {resource}: {e}") })),
    )
        .into_response()
}
