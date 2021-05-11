import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Prometheus } from "./prometheus-operator-crds/monitoring/v1";

const config = new pulumi.Config();
const default_name = "eshop";
const shared_labels = {
    "app.kubernetes.io/component": "prometheus",
    "app.kubernetes.io/name": "prometheus",
    "app.kubernetes.io/part-of": "eshop",
    "team": "eshop"
};

interface s3config {
    bucket: string,
    endpoint: string,
    access_key: string,
    secret_key: string
}

export function deploy(namespace: k8s.core.v1.Namespace) {
    const service_account = deploy_rbac(namespace);
    const object_storage_secret = deploy_object_storage_secret(namespace);
    const prometheus = deploy_prometheus(namespace, object_storage_secret, service_account);
    return {object_storage_secret, prometheus};
}

function deploy_object_storage_secret(namespace: k8s.core.v1.Namespace) {
    const s3config = config.requireSecretObject<s3config>("s3");
    const secretContent = pulumi.interpolate`
    type: s3
    config:
        bucket: ${s3config.bucket}
        endpoint: ${s3config.endpoint}
        insecure: true
        access_key: ${s3config.access_key}
        secret_key: ${s3config.secret_key}
        `;

    return secretContent.apply(x =>
        new k8s.core.v1.Secret("thanos-objectstorage", {
            metadata: {
                name: "thanos-objectstorage",
                namespace: namespace.metadata.name
            },

            type: "Opaque",
            stringData: {
                "thanos.yaml": x,
            }
        })
    );
}

function deploy_rbac(namespace: k8s.core.v1.Namespace) {
    const service_account = new k8s.core.v1.ServiceAccount(`prometheus-${default_name}`, {
        metadata: {
            labels: shared_labels,
            name: `prometheus-${default_name}`,
            namespace: namespace.metadata.name
        }
    });
    const subject = {
        kind: service_account.kind,
        name: service_account.metadata.name,
        namespace: service_account.metadata.namespace
    };

    const role_binding = new k8s.rbac.v1.RoleBinding(`prometheus-${default_name}`, {
        metadata: {
            labels: shared_labels,
            name: `prometheus-${default_name}`,
            namespace: subject.namespace
        },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: "ClusterRole",
            name: "prometheus-infrastructure"
        },
        subjects: [subject]
    })

    const config_role = new k8s.rbac.v1.Role(`prometheus-${default_name}-config`, {
        metadata: {
            labels: shared_labels,
            name: `prometheus-${default_name}-config`,
            namespace: subject.namespace
        },
        rules: [{
            apiGroups: [""],
            resources: ["configmaps"],
            verbs: ["get"]
        }]
    });

    const config_role_binding = new k8s.rbac.v1.RoleBinding(`prometheus-${default_name}-config`, {
        metadata: {
            labels: shared_labels,
            name: `prometheus-${default_name}-config`,
            namespace: subject.namespace
        },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: config_role.kind,
            name: config_role.metadata.name
        },
        subjects: [subject]
    });

    return service_account;
}

function deploy_prometheus(namespace: k8s.core.v1.Namespace, secret: pulumi.Output<k8s.core.v1.Secret>, service_account: k8s.core.v1.ServiceAccount) {
    const prometheus = new Prometheus(default_name, {
        metadata: {
            labels: { "prometheus": default_name, ...shared_labels },
            name: default_name,
            namespace: namespace.metadata.name,
        },
        spec: {
            externalLabels: {
                stack: pulumi.getStack(),
                namespace: namespace.metadata.name
            },
            podMonitorNamespaceSelector: {},
            podMonitorSelector: {},
            serviceMonitorNamespaceSelector: {
                matchLabels: {
                    team: namespace.metadata.name
                }
            },
            serviceMonitorSelector: {},
            thanos: {
                baseImage: "quay.io/thanos/thanos",
                version: "v0.8.1",
                objectStorageConfig: {
                    key: "thanos.yaml",
                    name: secret.metadata.name
                }
            },
            alerting: {
                alertmanagers: [{
                    apiVersion: "v2",
                    name: "alertmanager-main",
                    namespace: namespace.metadata.name,
                    port: "web"
                }]
            },
            image: "quay.io/prometheus/prometheus:v2.26.0",
            nodeSelector: {
                "kubernetes.io/os": "linux"
            },
            podMetadata: {
                labels: shared_labels
            },
            replicas: 1,
            resources: {
                requests: {
                    memory: "400Mi"
                }
            },
            ruleSelector: {
                matchLabels: {
                    "prometheus": default_name,
                    "role": "alert-rules",
                }
            },
            securityContext: {
                "fsGroup": 2000,
                "runAsNonRoot": true,
                "runAsUser": 1000
            },
            serviceAccountName: service_account.metadata.name,
            version: "2.26.0"
        }
    });

    const service = new k8s.core.v1.Service(`prometheus-${default_name}`, {
        metadata: {
            labels: { "prometheus": default_name, ...shared_labels },
            name: `prometheus-${default_name}`,
            namespace: namespace.metadata.name
        },
        spec: {
            ports: [{
                name: "web",
                port: 9090,
                targetPort: "web"
            }],
            selector: {
                "app": "prometheus",
                "prometheus": default_name
            },
            sessionAffinity: "ClientIP"
        },
    })

    return prometheus;
}


