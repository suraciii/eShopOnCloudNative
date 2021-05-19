import * as pulumi from "@pulumi/pulumi";
import * as fs from 'fs';
import { ServiceSpecType, Service, ConfigMap } from "@pulumi/kubernetes/core/v1";
import { app_host, app_name, namespace_name, shared_labels, team_name } from "./core";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Ingress } from "@pulumi/kubernetes/networking/v1beta1";


const config = new pulumi.Config();

export function deploy() {
    const configmap = deploy_configmap();
    const { deployment, service } = deploy_app(configmap)
    const ingress = deploy_ingress(service);
    return { deployment, service, ingress }
}

function deploy_configmap() {
    const configmap = new ConfigMap(`envoy-${app_name}`, {
        metadata: {
            namespace: namespace_name,
            name: `envoy-${app_name}`,
            labels: shared_labels
        },
        data: {
            "envoy.yaml": fs.readFileSync('./envoy.yaml').toString()
        }
    });
    return configmap;
}

function deploy_app(configmap: ConfigMap) {
    const deployment = new Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            labels: shared_labels
        },
        spec: {
            selector: {
                matchLabels: shared_labels
            },
            template: {
                metadata: {
                    labels: shared_labels
                },
                spec: {
                    volumes: [{
                        name: "config",
                        configMap: {
                            name: configmap.metadata.name,
                            items: [{
                                key: "envoy.yaml",
                                path: "envoy.yaml"
                            }]
                        }
                    }],
                    containers: [{
                        name: app_name,
                        image: "envoyproxy/envoy:v1.11.1",
                        imagePullPolicy: "Always",
                        ports: [{
                            name: "http",
                            containerPort: 80
                        }, {
                            name: "admin",
                            containerPort: 8001
                        }],
                        livenessProbe: {
                            httpGet: {
                                path: "/ready",
                                port: 8001
                            }
                        },
                        readinessProbe: {
                            httpGet: {
                                path: "/ready",
                                port: 8001
                            }
                        },
                        volumeMounts: [{
                            name: "config",
                            mountPath: "/etc/envoy"
                        }],
                        env: [{
                            name: "PATH_BASE",
                            value: "/webshoppingapigw"
                        }, {
                            name: "k8sname",
                            value: pulumi.getStack()
                        }],

                    }],
                }
            }
        }
    });

    const service = new Service(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            labels: shared_labels
        },
        spec: {
            ports: [{ name: "http", port: 80 }, { name: "admin", port: 8001 }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.ClusterIP
        }
    });

    return { deployment, service };
}

function deploy_ingress(service: Service) {
    return new Ingress(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            labels: shared_labels,
            annotations: {
                "cert-manager.io/cluster-issuer": "letsencrypt",
                "nginx.ingress.kubernetes.io/rewrite-target": "/",
                "ingress.kubernetes.io/rewrite-target": "/"
            }
        },
        spec: {
            ingressClassName: "nginx",
            tls: [
                {
                    hosts: [app_host],
                    secretName: `${app_name}-tls-secret`
                }
            ],
            rules: [
                {
                    host: app_host,
                    http: {
                        paths: [
                            {
                                path: "/",
                                pathType: "Prefix",
                                backend: {
                                    serviceName: service.metadata.name,
                                    servicePort: "http"
                                }
                            },
                        ],
                    },
                }
            ]
        }
    });
}

