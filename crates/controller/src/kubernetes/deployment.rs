use k8s_openapi::api::apps::v1::Deployment;
use kube::{
    Client,
    api::{Api, DeleteParams, Patch, PatchParams},
};
use serde_json::json;

use super::{APPS_NAMESPACE, FIELD_MANAGER, ensure_managed};

pub async fn apply_app_deployment(
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
            "labels": {
                "app": name,
                "app.kubernetes.io/name": name,
                "app.kubernetes.io/managed-by": "deployer"
            }
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

    if let Some(existing) = deployments.get_opt(name).await? {
        ensure_managed(&existing, name)?;
    }

    deployments
        .patch(
            name,
            &PatchParams::apply(FIELD_MANAGER).force(),
            &Patch::Apply(&deployment),
        )
        .await
}

pub async fn delete_app_deployment(client: Client, name: &str) -> Result<(), kube::Error> {
    let deployments: Api<Deployment> = Api::namespaced(client, APPS_NAMESPACE);
    match deployments.delete(name, &DeleteParams::default()).await {
        Ok(_) => Ok(()),
        Err(kube::Error::Api(error)) if error.code == 404 => Ok(()),
        Err(error) => Err(error),
    }
}
