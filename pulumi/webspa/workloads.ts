import { ConfigMap, Secret, Service, ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import { app_name, base_domain, image_repo, namespace_name, shared_labels, team_name } from "./core";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import * as pulumi from "@pulumi/pulumi";
import { Ingress } from "@pulumi/kubernetes/extensions/v1beta1";


export function deploy() {

    const secret = deploy_secret();
    const configmap = deploy_configmap();
    const deployment = deploy_deployment(configmap, secret);
    const service = deploy_service(deployment)
    const ingress = deploy_ingress(service);
    return { deployment, service, ingress }
}


function deploy_secret() {
    const secret = new Secret(app_name, {
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
    const configmap = new ConfigMap(app_name, {
        metadata: {
            namespace: namespace_name,
            name: app_name
        },
        data: {
            "IdentityUrlHC": "http://identity-api.eshop.svc.cluster.local/hc",
            "IdentityUrl": "https://eshop.ichnb.com/identity",
            "PurchaseUrl": `https://${base_domain}/webshoppingapigw`,
            "CallBackUrl": `https://${base_domain}/`,
            "SignalrHubUrl": `https://${base_domain}/hub/notificationhub`,
            "BasketUrl": `https://${base_domain}/b/`
        }
    });
    return configmap;
}

function deploy_deployment(configmap: ConfigMap, secret: Secret) {
    const image_version = process.env["IMAGE_VERSION"];
    if (!image_version) { throw "missing IMAGE_VERSION" }
    const labels: { [key: string]: string } = {
        app: app_name,
        ...shared_labels
    };
    const deployment = new Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
        },
        spec: {
            selector: {
                matchLabels: labels
            },
            template: {
                metadata: {
                    labels: labels,
                    annotations: {
                        "linkerd.io/inject": "enabled"
                    }
                },
                spec: {
                    containers: [{
                        name: app_name,
                        image: `${image_repo}:linux-${image_version}`,
                        ports: [{
                            name: 'http',
                            containerPort: 80
                        }],
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
                }
            }
        }
    });

    return deployment;
}

function deploy_service(deployment: Deployment) {
    return new Service(app_name, {
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

function deploy_ingress(service: Service) {
    return new Ingress(app_name, {
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

