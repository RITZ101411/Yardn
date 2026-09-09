use k8s_openapi::api::core::v1::Service;
use kube::{
    Client,
    api::{Api, PostParams},
};
use serde_json::json;

use super::APPS_NAMESPACE;

/// Create a ClusterIP Service that routes to the app's Pods.
pub async fn create_app_service(
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
            "labels": { "app": name, "managed-by": "deploy" }
        },
        "spec": {
            "type": "ClusterIP",
            "selector": { "app": name },
            "ports": [{ "port": port, "targetPort": port }]
        }
    }))
    .expect("valid service spec");

    services.create(&PostParams::default(), &service).await
}

pub async fn delete_app_service(client: Client, name: &str) -> Result<(), kube::Error> {
    let services: Api<Service> = Api::namespaced(client, APPS_NAMESPACE);
    match services.delete(name, &kube::api::DeleteParams::default()).await {
        Ok(_) => Ok(()),
        Err(kube::Error::Api(e)) if e.code == 404 => Ok(()),
        Err(e) => Err(e),
    }
}
