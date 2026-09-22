use k8s_openapi::api::core::v1::Service;
use kube::{
    Client,
    api::{Api, Patch, PatchParams},
};
use serde_json::json;

use super::{APPS_NAMESPACE, FIELD_MANAGER, ensure_managed};

/// Create a ClusterIP Service that routes to the app's Pods.
pub async fn apply_app_service(
    client: Client,
    name: &str,
    port: i32,
) -> Result<Service, kube::Error> {
    let services: Api<Service> = Api::namespaced(client, APPS_NAMESPACE);

    let service: Service = serde_json::from_value(json!({
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": name,
            "namespace": APPS_NAMESPACE,
            "labels": {
                "app": name,
                "app.kubernetes.io/name": name,
                "app.kubernetes.io/managed-by": "deployer"
            }
        },
        "spec": {
            "type": "ClusterIP",
            "selector": { "app": name },
            "ports": [{ "port": port, "targetPort": port }]
        }
    }))
    .expect("valid service spec");

    if let Some(existing) = services.get_opt(name).await? {
        ensure_managed(&existing, name)?;
    }

    services
        .patch(
            name,
            &PatchParams::apply(FIELD_MANAGER).force(),
            &Patch::Apply(&service),
        )
        .await
}

pub async fn delete_app_service(client: Client, name: &str) -> Result<(), kube::Error> {
    let services: Api<Service> = Api::namespaced(client, APPS_NAMESPACE);
    match services
        .delete(name, &kube::api::DeleteParams::default())
        .await
    {
        Ok(_) => Ok(()),
        Err(kube::Error::Api(e)) if e.code == 404 => Ok(()),
        Err(e) => Err(e),
    }
}
