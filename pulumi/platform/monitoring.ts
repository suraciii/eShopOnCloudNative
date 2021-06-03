import * as pulumi from "@pulumi/pulumi";
import { Alertmanager, Prometheus } from "@pulumi/prometheus-operator-crds/monitoring/v1";
import { AlertmanagerConfig } from "@pulumi/prometheus-operator-crds/monitoring/v1alpha1";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Namespace, Secret, Service, ServiceAccount, ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import { labels_without_version } from "./utils";
import { Role, RoleBinding } from "@pulumi/kubernetes/rbac/v1";

const config = new pulumi.Config();
const default_name = "eshop";
const shared_labels = {
    "team": "eshop",
    "app.kubernetes.io/part-of": "eshop-monitoring",
    "app.kubernetes.io/version": "2.26.0"
};
const prometheus_labels = {
    "prometheus": "eshop",
    "app.kubernetes.io/component": "prometheus",
    "app.kubernetes.io/name": "prometheus",
    ...shared_labels
}

const alertmanager_labels = {
    "alertmanager": "eshop",
    "app.kubernetes.io/component": "alert-router",
    "app.kubernetes.io/name": "alertmanager",
    ...shared_labels
}

interface s3config {
    bucket: string,
    endpoint: string,
    access_key: string,
    secret_key: string
}
interface amwh_dingtalk_config {
    access_token: string,
    secret: string,
    mention: string,
}

export function deploy(namespace: Namespace) {
    const { alertmanager_service } = deploy_alertmanager(namespace);
    deploy_alertmanager_webhook_dingtalk(namespace);

    const service_account = deploy_rbac(namespace);
    const object_storage_secret = deploy_object_storage_secret(namespace);
    const prometheus = deploy_prometheus(namespace, object_storage_secret, service_account, alertmanager_service);
    return { object_storage_secret, prometheus };
}

function deploy_object_storage_secret(namespace: Namespace) {
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
        new Secret("thanos-objectstorage", {
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

function deploy_rbac(namespace: Namespace) {
    const service_account = new ServiceAccount(`prometheus-${default_name}`, {
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

    const role_binding = new RoleBinding(`prometheus-${default_name}`, {
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

    const config_role = new Role(`prometheus-${default_name}-config`, {
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

    const config_role_binding = new RoleBinding(`prometheus-${default_name}-config`, {
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

function deploy_prometheus(namespace: Namespace,
    secret: pulumi.Output<Secret>,
    service_account: ServiceAccount,
    alertmanager_service: Service) {
    const prometheus = new Prometheus(default_name, {
        metadata: {
            labels: prometheus_labels,
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
                    name: alertmanager_service.metadata.name,
                    namespace: alertmanager_service.metadata.namespace,
                    port: "web"
                }]
            },
            image: "quay.io/prometheus/prometheus:v2.26.0",
            podMetadata: {
                labels: prometheus_labels
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

    const service = new Service(`prometheus-${default_name}`, {
        metadata: {
            labels: prometheus_labels,
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


function deploy_alertmanager(namespace: Namespace) {
    const alertmanager_config = new AlertmanagerConfig(default_name, {
        metadata: {
            labels: alertmanager_labels,
            name: default_name,
            namespace: namespace.metadata.name,
        },
        spec: {
            route: {
                groupBy: ['job'],
                groupWait: "30s",
                groupInterval: "5m",
                repeatInterval: "12h",
                receiver: 'wh'
            },
            receivers: [{
                name: "wh",
                webhookConfigs: [{
                    url: "http://alertmanager-webhook-dingtalk.eshop.svc.cluster.local/dingtalk/webhook1/send"
                }]
            }]
        }
    });
    const alertmanager = new Alertmanager(default_name, {
        metadata: {
            labels: alertmanager_labels,
            name: default_name,
            namespace: namespace.metadata.name,
        },
        spec: {
            replicas: 1,
            image: "quay.io/prometheus/alertmanager:v0.21.0",
            podMetadata: {
                labels: alertmanager_labels
            },
            resources: {
                limits: {
                    cpu: "100m",
                    memory: "100Mi"
                },
                requests: {
                    cpu: "4m",
                    memory: "100Mi"
                }
            },
            securityContext: {
                fsGroup: 2000,
                runAsNonRoot: true,
                runAsUser: 1000
            },
            alertmanagerConfigSelector: {
                matchLabels: {
                    team: default_name
                }
            },
            version: "0.21.0"
        }
    });

    const alertmanager_service = new Service(`alertmanager-${default_name}`, {
        metadata: {
            labels: alertmanager_labels,
            name: `alertmanager-${default_name}`,
            namespace: namespace.metadata.name
        },
        spec: {
            ports: [{
                name: "web",
                port: 9093,
                targetPort: "web"
            }],
            selector: { "app": "alertmanager", ...labels_without_version(alertmanager_labels) },
            sessionAffinity: "ClientIP"
        },
    })
    return { alertmanager, alertmanager_config, alertmanager_service };
}

function deploy_alertmanager_webhook_dingtalk(namespace: Namespace) {
    const app_name = "alertmanager-webhook-dingtalk"
    const labels: { [key: string]: string } = {
        app: app_name,
        ...shared_labels
    };

    const amwh_dingtalk_config = config.requireSecretObject<amwh_dingtalk_config>("amwh_dingtalk_config");
    const secretContent = pulumi.interpolate`
targets:
    webhook1:
        url: https://oapi.dingtalk.com/robot/send?access_token=${amwh_dingtalk_config.access_token}
        secret: ${amwh_dingtalk_config.secret}
        mention:
            mobiles: ['${amwh_dingtalk_config.mention}']
        `;

    const secret = new Secret(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace.metadata.name,
            labels: labels
        },
        type: "Opaque",
        stringData: {
            "config.yml": secretContent,
        }
    })

    const deployment = new Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace.metadata.name,
            labels: labels
        },
        spec: {
            selector: {
                matchLabels: labels
            },
            template: {
                metadata: {
                    labels: labels
                },
                spec: {
                    containers: [{
                        name: app_name,
                        image: "timonwong/prometheus-webhook-dingtalk",
                        ports: [{
                            name: 'http',
                            containerPort: 8060
                        }],
                        args: [
                            "--log.level=debug",
                            "--web.enable-ui",
                            "--config.file=/etc/prometheus-webhook-dingtalk/config/config.yml"
                        ],
                        volumeMounts: [{ mountPath: "/etc/prometheus-webhook-dingtalk/config", name: "config" }]
                    }],
                    volumes: [{
                        name: "config",
                        secret: {
                            secretName: secret.metadata.name,
                        }
                    }]
                }
            }
        }
    });

    const service = new Service(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace.metadata.name,
            labels: labels
        },
        spec: {
            ports: [{
                name: "http",
                port: 80,
                targetPort: 8060
            }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.ClusterIP
        }
    });
}

