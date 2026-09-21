pub mod deployment;
pub mod ingressroute;
pub mod reconcile;
pub mod service;

use kube::{ResourceExt, core::ErrorResponse};

pub const APPS_NAMESPACE: &str = "deploy-apps";
pub const FIELD_MANAGER: &str = "deployer-controller";

pub fn ensure_managed<K: ResourceExt>(resource: &K, name: &str) -> Result<(), kube::Error> {
    let labels = resource.labels();
    let managed = labels
        .get("app.kubernetes.io/managed-by")
        .is_some_and(|value| value == "deployer")
        || labels
            .get("managed-by")
            .is_some_and(|value| value == "deploy");

    if managed {
        return Ok(());
    }

    Err(kube::Error::Api(ErrorResponse {
        status: "Failure".to_string(),
        message: format!("resource '{name}' already exists and is not managed by Deployer"),
        reason: "Conflict".to_string(),
        code: 409,
    }))
}

#[cfg(test)]
mod tests {
    use k8s_openapi::{api::apps::v1::Deployment, apimachinery::pkg::apis::meta::v1::ObjectMeta};
    use std::collections::BTreeMap;

    use super::ensure_managed;

    fn deployment_with_label(key: &str, value: &str) -> Deployment {
        Deployment {
            metadata: ObjectMeta {
                labels: Some(BTreeMap::from([(key.to_string(), value.to_string())])),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    #[test]
    fn accepts_deployer_managed_resource() {
        let deployment = deployment_with_label("app.kubernetes.io/managed-by", "deployer");

        assert!(ensure_managed(&deployment, "example").is_ok());
    }

    #[test]
    fn accepts_legacy_managed_resource() {
        let deployment = deployment_with_label("managed-by", "deploy");

        assert!(ensure_managed(&deployment, "example").is_ok());
    }

    #[test]
    fn rejects_unmanaged_resource() {
        let deployment = Deployment::default();

        let error = ensure_managed(&deployment, "example").unwrap_err();
        assert!(matches!(error, kube::Error::Api(response) if response.code == 409));
    }
}
