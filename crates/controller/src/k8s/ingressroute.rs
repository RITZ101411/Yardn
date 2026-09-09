use kube::{
    Client,
    api::{Api, DynamicObject, GroupVersionKind, PostParams},
    core::ApiResource,
};
use serde_json::json;

use super::APPS_NAMESPACE;

/// Create a Traefik IngressRoute exposing the app at `<name>.<base_domain>`.
pub async fn create_app_ingressroute(
    client: Client,
    name: &str,
    port: i32,
    base_domain: &str,
) -> Result<DynamicObject, kube::Error> {
    // Traefik IngressRoute is a CRD, handled via DynamicObject.
    let gvk = GroupVersionKind::gvk("traefik.io", "v1alpha1", "IngressRoute");
    let ar = ApiResource::from_gvk(&gvk);
    let api: Api<DynamicObject> = Api::namespaced_with(client, APPS_NAMESPACE, &ar);

    let host = format!("{name}.{base_domain}");

    let ingressroute: DynamicObject = serde_json::from_value(json!({
        "apiVersion": "traefik.io/v1alpha1",
        "kind": "IngressRoute",
        "metadata": {
            "name": name,
            "namespace": APPS_NAMESPACE,
            "labels": { "app": name, "managed-by": "deploy" }
        },
        "spec": {
            "entryPoints": ["web"],
            "routes": [{
                "match": format!("Host(`{host}`)"),
                "kind": "Rule",
                "services": [{ "name": name, "port": port }]
            }]
        }
    }))
    .expect("valid ingressroute spec");

    api.create(&PostParams::default(), &ingressroute).await
}

pub async fn delete_app_ingressroute(client: Client, name: &str) -> Result<(), kube::Error> {
    let gvk = GroupVersionKind::gvk("traefik.io", "v1alpha1", "IngressRoute");
    let ar = ApiResource::from_gvk(&gvk);
    let api: Api<DynamicObject> = Api::namespaced_with(client, APPS_NAMESPACE, &ar);

    match api.delete(name, &kube::api::DeleteParams::default()).await {
        Ok(_) => Ok(()),
        Err(kube::Error::Api(e)) if e.code == 404 => Ok(()),
        Err(e) => Err(e),
    }
}
