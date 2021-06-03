import * as pulumi from "@pulumi/pulumi";
import { team_name } from "./core";
import { Namespace, Secret, Service, ServiceAccount } from "@pulumi/kubernetes/core/v1";
import { Deployment, StatefulSet } from "@pulumi/kubernetes/apps/v1";
import { ServiceMonitor } from "@pulumi/prometheus-operator-crds/monitoring/v1";
import { labels_without_version } from "./utils";

const shared_labels = {
    "team": team_name,
    "app.kubernetes.io/part-of": "eshop-monitoring",
    "app.kubernetes.io/version": "v0.19.0",
}

const query_labels = {
    "app.kubernetes.io/component": "query-layer",
    "app.kubernetes.io/instance": "thanos-query",
    "app.kubernetes.io/name": "thanos-query",
    ...shared_labels
};
const query_labels_without_version = labels_without_version(query_labels);

const store_labels = {
    "app.kubernetes.io/component": "object-store-gateway",
    "app.kubernetes.io/instance": "thanos-store",
    "app.kubernetes.io/name": "thanos-store",
    ...shared_labels
};
const store_labels_without_version = labels_without_version(store_labels);

export function deploy(namespace: Namespace, object_storage_secret: pulumi.Output<Secret>) {
    const sidecar_service = deploy_sidecar_service(namespace);

    const store_sa = deploy_store_service_account(namespace);
    const store_statefulset = deploy_store_statefulset(store_sa, object_storage_secret);
    const store_service = deploy_store_service(store_statefulset);
    const store_service_monitor = deploy_store_service_monitor(store_service);

    const query_sa = deploy_query_service_account(namespace);
    const query_deploy = deploy_query_deployment(query_sa, sidecar_service, store_service);
    const query_service = deploy_query_service(query_deploy);
    const query_service_monitor = deploy_query_service_monitor(query_service);

    return { store_service_monitor, query_service_monitor };
}

function deploy_sidecar_service(namespace: Namespace) {
    var service = new Service("thanos-sidecar", {
        metadata: {
            name: "thanos-sidecar",
            namespace: namespace.metadata.name,
        },
        spec: {
            ports: [{
                name: "grpc",
                port: 10901,
                targetPort: "grpc"
            }],
            selector: {
                prometheus: team_name,
            }
        }
    });
    return service;
}

function deploy_store_service_account(namespace: Namespace) {
    const service_account = new ServiceAccount("thanos-store", {
        metadata: {
            name: "thanos-store",
            namespace: namespace.metadata.name,
            labels: store_labels
        }
    })
    return service_account;
}

function deploy_store_statefulset(service_account: ServiceAccount, object_storage_secret: pulumi.Output<Secret>) {
    var statefulset = new StatefulSet("thanos-store", {
        metadata: {
            name: "thanos-store",
            namespace: service_account.metadata.namespace,
            labels: store_labels
        },
        spec: {
            selector: { matchLabels: store_labels_without_version },
            serviceName: "thanos-store",
            template: {
                metadata: {
                    labels: store_labels
                },
                spec: {
                    affinity: {
                        podAntiAffinity: {
                            preferredDuringSchedulingIgnoredDuringExecution: [{
                                podAffinityTerm: {
                                    labelSelector: {
                                        matchExpressions: [{
                                            key: "app.kubernetes.io/name",
                                            operator: "In",
                                            values: ["thanos-store"]
                                        }, {
                                            key: "app.kubernetes.io/instance",
                                            operator: "In",
                                            values: ["thanos-store"]
                                        }],
                                    },
                                    namespaces: [service_account.metadata.namespace],
                                    topologyKey: "kubernetes.io/hostname"
                                },
                                weight: 100
                            }]
                        }
                    },
                    containers: [{
                        args: [
                            "store",
                            "--log.level=info",
                            "--log.format=logfmt",
                            "--data-dir=/var/thanos/store",
                            "--grpc-address=0.0.0.0:10901",
                            "--http-address=0.0.0.0:10902",
                            "--objstore.config=$(OBJSTORE_CONFIG)",
                            "--ignore-deletion-marks-delay=24h",
                        ],
                        env: [{
                            name: "OBJSTORE_CONFIG",
                            valueFrom: {
                                secretKeyRef: {
                                    key: "thanos.yaml",
                                    name: object_storage_secret.metadata.name
                                }
                            }
                        }, {
                            name: "HOST_IP_ADDRESS",
                            valueFrom: {
                                fieldRef: {
                                    fieldPath: "status.hostIP"
                                }
                            }
                        }],
                        image: "quay.io/thanos/thanos:v0.19.0",
                        livenessProbe: {
                            failureThreshold: 8,
                            httpGet: {
                                path: "/-/healthy",
                                port: 10902,
                                scheme: "HTTP"
                            },
                            periodSeconds: 30
                        },
                        name: "thanos-store",
                        ports: [{
                            containerPort: 10901,
                            name: "grpc"
                        }, {
                            containerPort: 10902,
                            name: "http"
                        }],
                        readinessProbe: {
                            failureThreshold: 20,
                            httpGet: {
                                path: "/-/ready",
                                port: 10902,
                                scheme: "HTTP"
                            },
                            periodSeconds: 5
                        },
                        terminationMessagePolicy: "FallbackToLogsOnError",
                        volumeMounts: [{
                            mountPath: "/var/thanos/store",
                            name: "data",
                            readOnly: false
                        }],
                    }],
                    securityContext: {
                        fsGroup: 65534,
                        runAsUser: 65534
                    },
                    serviceAccountName: service_account.metadata.name,
                    terminationGracePeriodSeconds: 120,
                },
            },
            volumeClaimTemplates: [{
                metadata: {
                    labels: store_labels_without_version,
                    name: "data"
                },
                spec: {
                    storageClassName: "alicloud-disk-ssd",
                    accessModes: ["ReadWriteOnce"],
                    resources: {
                        requests: {
                            storage: "20Gi"
                        }
                    }
                }
            }]
        }
    });
    return statefulset;
}

function deploy_store_service(statefulset: StatefulSet) {
    const service = new Service("thanos-store", {
        metadata: {
            name: "thanos-store",
            namespace: statefulset.metadata.namespace,
            labels: store_labels
        },
        spec: {
            clusterIP: "None",
            ports: [{
                name: "grpc",
                port: 10901,
            }, {
                name: "http",
                port: 10902,
            }],
            selector: statefulset.spec.template.metadata.labels
        },
    });
    return service;
}

function deploy_store_service_monitor(service: Service) {
    var service_monitor = new ServiceMonitor("thanos-store", {
        metadata: {
            name: "thanos-store",
            namespace: service.metadata.namespace,
            labels: store_labels
        },
        spec: {
            endpoints: [{
                port: "http",
                relabelings: [{
                    separator: "/",
                    sourceLabels: ["namespace", "pod"],
                    targetLabel: "instance"
                }],
            }],
            selector: {
                matchLabels: service.metadata.labels
            }
        }
    });
    return service_monitor;
}

function deploy_query_service_account(namespace: Namespace) {
    const service_account = new ServiceAccount("thanos-query", {
        metadata: {
            name: "thanos-query",
            namespace: namespace.metadata.name,
            labels: query_labels
        }
    });
    return service_account;
}

function deploy_query_deployment(service_account: ServiceAccount, sidecar_service: Service, store_service: Service) {
    const deployment = new Deployment("thanos-query", {
        metadata: {
            "name": "thanos-query",
            namespace: service_account.metadata.namespace
        },
        spec: {
            selector: {
                matchLabels: query_labels_without_version,
            },
            template: {
                metadata: {
                    labels: query_labels
                },
                spec: {
                    affinity: {
                        podAntiAffinity: {
                            preferredDuringSchedulingIgnoredDuringExecution: [{
                                podAffinityTerm: {
                                    labelSelector: {
                                        matchExpressions: [{
                                            key: "app.kubernetes.io/name",
                                            operator: "In",
                                            values: ["thanos-query"]
                                        }],
                                    },
                                    namespaces: [service_account.metadata.namespace],
                                    topologyKey: "kubernetes.io/hostname"
                                },
                                weight: 100
                            }]
                        }
                    },
                    containers: [{
                        args: [
                            "query",
                            "--grpc-address=0.0.0.0:10901",
                            "--http-address=0.0.0.0:9090",
                            "--log.level=info",
                            "--log.format=logfmt",
                            "--query.replica-label=prometheus_replica",
                            "--query.replica-label=rule_replica",
                            pulumi.interpolate`--store=dnssrv+_grpc._tcp.${sidecar_service.metadata.name}.${sidecar_service.metadata.namespace}.svc.cluster.local`,
                            pulumi.interpolate`--store=dnssrv+_grpc._tcp.${store_service.metadata.name}.${store_service.metadata.namespace}.svc.cluster.local`,
                            "--query.auto-downsampling",
                        ],
                        env: [{
                            name: "HOST_IP_ADDRESS",
                            valueFrom: {
                                fieldRef: {
                                    fieldPath: "status.hostIP"
                                }
                            }
                        }],
                        image: "quay.io/thanos/thanos:v0.19.0",
                        livenessProbe: {
                            failureThreshold: 4,
                            httpGet: {
                                path: "/-/healthy",
                                port: 9090,
                                scheme: "HTTP"
                            },
                            periodSeconds: 30
                        },
                        name: "thanos-query",
                        ports: [{
                            containerPort: 10901,
                            name: "grpc"
                        }, {
                            containerPort: 9090,
                            name: "http"
                        }],
                        readinessProbe: {
                            failureThreshold: 20,
                            httpGet: {
                                path: "/-/ready",
                                port: 9090,
                                scheme: "HTTP"
                            },
                            periodSeconds: 5
                        },
                        terminationMessagePolicy: "FallbackToLogsOnError",
                    }],
                    securityContext: {
                        fsGroup: 65534,
                        runAsUser: 65534,
                    },
                    serviceAccountName: service_account.metadata.name,
                    terminationGracePeriodSeconds: 120
                }
            }
        }
    });
    return deployment;
}

function deploy_query_service(deployment: Deployment) {
    const service = new Service("thanos-query", {
        metadata: {
            name: "thanos-query",
            namespace: deployment.metadata.namespace,
            labels: query_labels
        },
        spec: {
            ports: [{
                name: "grpc",
                port: 10901,
            }, {
                name: "http",
                port: 9090,
            }],
            selector: deployment.spec.template.metadata.labels
        },
    });
    return service;
}

function deploy_query_service_monitor(service: Service) {
    var service_monitor = new ServiceMonitor("thanos-query", {
        metadata: {
            name: "thanos-query",
            namespace: service.metadata.namespace,
            labels: query_labels
        },
        spec: {
            endpoints: [{
                port: "http",
                relabelings: [{
                    separator: "/",
                    sourceLabels: ["namespace", "pod"],
                    targetLabel: "instance"
                }],
            }],
            selector: {
                matchLabels: service.metadata.labels
            }
        }
    });
    return service_monitor;
}
