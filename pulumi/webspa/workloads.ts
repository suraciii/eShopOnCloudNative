import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import * as kx from "@pulumi/kubernetesx";
import { app_name, base_domain, image_repo, namespace_name, team_name } from "./core";

const config = new pulumi.Config();

export function deploy() {

    const secret = deploy_secret();
    const configmap = deploy_configmap();
    const deployment = deploy_deployment(configmap, secret);
    const service = deploy_service(deployment)
    const ingress = deploy_ingress(service);
    return { deployment, service, ingress }
}


function deploy_secret() {
    const secret = new k8s.core.v1.Secret(app_name, {
        metadata: {
            namespace: namespace_name,
            name: app_name
        },
        type: "Opaque",
        stringData: {
            "foo": "bar"
            // "DPConnectionString": config.requireSecret("DPConnectionString")
        }
    });
    return secret;
}

function deploy_configmap() {
    const configmap = new k8s.core.v1.ConfigMap(app_name, {
        metadata: {
            namespace: namespace_name,
            name: app_name
        },
        data: {
            "IdentityUrlHC": "http://identity-api.eshop.svc.cluster.local/hc",
            "IdentityUrl": "https://eshop.ichnb.com/identity",
            "PurchaseUrl": `https://${base_domain}/webshoppingapigw`,
            "CallBackUrl": `https://${base_domain}/`
        }
    });
    return configmap;
}

function deploy_deployment(configmap: k8s.core.v1.ConfigMap, secret: k8s.core.v1.Secret) {
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
            },
            env: [{
                name: "PATH_BASE",
                value: "/"
            }, {
                name: "ASPNETCORE_ENVIRONMENT",
                value: pulumi.getStack()
            }],
            envFrom: [{
                secretRef: { name: secret.metadata.name }
            }, {
                configMapRef: { name: configmap.metadata.name }

            }],
        }],
    });

    const deployment = new kx.Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
        },
        spec: pb.asDeploymentSpec({ replicas: 1 })
    });

    return deployment;
}

function deploy_service(deployment: kx.Deployment) {
    return new k8s.core.v1.Service(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            labels: {
                app: app_name,
                team: team_name
            }
        },
        spec: {
            ports: [{ name: "http", port: 80 }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.ClusterIP
        }
    });
}

function deploy_ingress(service: k8s.core.v1.Service) {
    return new k8s.networking.v1beta1.Ingress(app_name, {
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
                    hosts: [base_domain],
                    secretName: `${team_name}-tls-secret`
                }
            ],
            rules: [
                {
                    host: base_domain,
                    http: {
                        paths: [
                            {
                                path: "/",
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

