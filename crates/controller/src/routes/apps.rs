use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{post, put},
};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::kubernetes::reconcile::{delete_app as delete_app_resources, reconcile_app};

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
    if let Err(error) = reconcile_app(&state, &req.name, &req.image, req.port).await {
        return internal_error("app", error);
    }

    let url = format!("http://{}.{}", req.name, state.base_domain);
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
    if let Err(error) = reconcile_app(&state, &name, &req.image, req.port).await {
        return internal_error("app", error);
    }

    let url = format!("http://{}.{}", name, state.base_domain);
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

async fn delete_app(State(state): State<AppState>, Path(name): Path<String>) -> impl IntoResponse {
    let AppState { client, .. } = state;

    if let Err(error) = delete_app_resources(client, &name).await {
        return internal_error("app", error);
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({ "name": name, "status": "deleted" })),
    )
        .into_response()
}

fn internal_error(resource: &str, e: kube::Error) -> axum::response::Response {
    tracing::error!("failed to update/create {resource}: {e}");
    let status = match &e {
        kube::Error::Api(response) if response.code == 409 => StatusCode::CONFLICT,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };

    (
        status,
        Json(serde_json::json!({ "error": format!("failed to process {resource}: {e}") })),
    )
        .into_response()
}
