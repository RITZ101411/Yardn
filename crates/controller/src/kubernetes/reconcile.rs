use k8s_openapi::api::{apps::v1::Deployment, core::v1::Service};
use kube::{
    Client,
    api::{Api, DynamicObject, GroupVersionKind},
    core::ApiResource,
};

use crate::app::AppState;

use super::{
    APPS_NAMESPACE,
    deployment::{apply_app_deployment, delete_app_deployment},
    ensure_managed,
    ingressroute::{apply_app_ingressroute, delete_app_ingressroute},
    service::{apply_app_service, delete_app_service},
};

pub async fn reconcile_app(
    state: &AppState,
    name: &str,
    image: &str,
    port: i32,
) -> Result<(), kube::Error> {
    ensure_app_resources_managed(state.client.clone(), name).await?;

    apply_app_deployment(state.client.clone(), name, image, port).await?;
    apply_app_service(state.client.clone(), name, port).await?;
    apply_app_ingressroute(state.client.clone(), name, port, &state.base_domain).await?;

    Ok(())
}

pub async fn delete_app(client: Client, name: &str) -> Result<(), kube::Error> {
    ensure_app_resources_managed(client.clone(), name).await?;

    delete_app_deployment(client.clone(), name).await?;
    delete_app_service(client.clone(), name).await?;
    delete_app_ingressroute(client, name).await?;
    Ok(())
}

async fn ensure_app_resources_managed(client: Client, name: &str) -> Result<(), kube::Error> {
    let deployments: Api<Deployment> = Api::namespaced(client.clone(), APPS_NAMESPACE);
    if let Some(deployment) = deployments.get_opt(name).await? {
        ensure_managed(&deployment, name)?;
    }

    let services: Api<Service> = Api::namespaced(client.clone(), APPS_NAMESPACE);
    if let Some(service) = services.get_opt(name).await? {
        ensure_managed(&service, name)?;
    }

    let gvk = GroupVersionKind::gvk("traefik.io", "v1alpha1", "IngressRoute");
    let api_resource = ApiResource::from_gvk(&gvk);
    let ingressroutes: Api<DynamicObject> =
        Api::namespaced_with(client, APPS_NAMESPACE, &api_resource);
    if let Some(ingressroute) = ingressroutes.get_opt(name).await? {
        ensure_managed(&ingressroute, name)?;
    }

    Ok(())
}
