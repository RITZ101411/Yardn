use k8s_openapi::api::apps::v1::Deployment;
use kube::{
    Client,
    api::{Api, PostParams},
};
use serde_json::json;

use super::APPS_NAMESPACE;

pub async fn create_app_deployment(
    client: Client,
    name: &str,
    image: &str,
    port: i32,
) -> Result<Deployment, kube::Error> {
    let deployments: Api<Deployment> = Api::namespaced(client, APPS_NAMESPACE);

    let deployment: Deployment = serde_json::from_value(json!({
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": name,
            "namespace": APPS_NAMESPACE,
            "labels": { "app": name, "managed-by": "deploy" }
        },
        "spec": {
            "replicas": 1,
            "selector": { "matchLabels": { "app": name } },
            "template": {
                "metadata": { "labels": { "app": name } },
                "spec": {
                    "containers": [{
                        "name": name,
                        "image": image,
                        "ports": [{ "containerPort": port }]
                    }]
                }
            }
        }
    }))
    .expect("valid deployment spec");

    deployments.create(&PostParams::default(), &deployment).await
}
