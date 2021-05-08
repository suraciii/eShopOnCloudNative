
import * as k8s from "@pulumi/kubernetes";
import { ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import * as kx from "@pulumi/kubernetesx";
import { app_host, app_name, image_repo, namespace_name } from "./core";

export function deploy() {
    const image_version = process.env["IMAGE_VERSION"];
    if (!image_version) { throw "missing IMAGE_VERSION" }

    const deployment = new k8s.apps.v1.Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            annotations: { "pulumi.com/skipAwait": "true" },
            labels: {
                app: app_name
            }
        },
        spec: {
            selector: {
                matchLabels: {
                    app: app_name
                }
            },
            template: {
                metadata: {
                    labels: {
                        app: app_name
                    }
                },
                spec: {
                    containers: [{
                        name: app_name,
                        image: `${image_repo}:${image_version}`,
                        ports: [{ name: 'http', containerPort: 80 }],
                    }],
                    nodeSelector: {
                        "kubernetes.io/hostname": "cn-hangzhou.192.168.22.238"
                    }
                }
            }
        }
    })

    const service = new k8s.core.v1.Service(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
        },
        spec: {
            ports: [{ name: "http", port: 80 }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.LoadBalancer
        }

    })

    const ingress = new k8s.networking.v1beta1.Ingress(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            annotations: {
                "cert-manager.io/cluster-issuer": "letsencrypt"
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

    return { deployment, ingress }
}
