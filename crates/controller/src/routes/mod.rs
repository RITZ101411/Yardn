use axum::Router;

use crate::app::AppState;

pub mod apps;
pub mod health;

pub fn router() -> Router<AppState> {
    Router::new().merge(health::routes()).merge(apps::routes())
}
