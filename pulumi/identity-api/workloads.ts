
import * as k8s from "@pulumi/kubernetes";
import { ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import * as kx from "@pulumi/kubernetesx";
import { app_name, image_repo, namespace_name } from "./core";

export function deploy() {
    const image_version = process.env["IMAGE_VERSION"];
    if (!image_version) { throw "missing IMAGE_VERSION" }
    const pb = new kx.PodBuilder({
        containers: [{
            image: `${image_repo}:linux-${image_version}`,
            ports: { http: 80 },
            livenessProbe: {
                httpGet: {
                    path: "/liveness",
                    port: 80

                }
            },
            readinessProbe: {
                httpGet: {
                    path: "/hc",
                    port: 80
                }
            }
        }],
    });

    const deployment = new kx.Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            annotations: { "pulumi.com/skipAwait": "true" }
        },
        spec: pb.asDeploymentSpec({ replicas: 1 })
    });


    const service = new k8s.core.v1.Service(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
        },
        spec: {
            ports: [{ name: "http", port: 80 }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.ClusterIP
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
                    hosts: ["identity.e.doomed.app"],
                    secretName: "tls-secret"
                }
            ],
            rules: [
                {
                    host: "identity.e.doomed.app",
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
