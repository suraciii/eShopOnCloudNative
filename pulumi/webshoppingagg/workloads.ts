import * as pulumi from "@pulumi/pulumi";
import { ConfigMap, Secret, Service, ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import { service_name, app_name, image_repo, namespace_name, team_name } from "./core";
import { Job } from "@pulumi/kubernetes/batch/v1";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Ingress } from "@pulumi/kubernetes/networking/v1beta1";

const config = new pulumi.Config();
const image_version = process.env["IMAGE_VERSION"];
if (!image_version) { throw "missing IMAGE_VERSION" };
const image = `${image_repo}:linux-${image_version}`;

export function deploy() {
    const secret = deploy_secret();
    const configmap = deploy_configmap();
    const deployment = deploy_deployment(configmap, secret);
    const service = deploy_service(deployment)
    return { deployment, service }
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
            "urls__basket": "http://localhost:5555",
            "urls__catalog": "http://localhost:5555",
            "urls__orders": "http://localhost:5555",
            "urls__identity": "http://identity-api.eshop.svc.cluster.local",
            "urls__grpcCatalog": "http://localhost:5555",
            "urls__grpcOrdering": "http://localhost:5555",
            "CatalogUrlHC": "http://localhost:5555/hc",
            "OrderingUrlHC": "http://localhost:5555/hc",
            "BasketUrlHC": "http://localhost:5555/hc",
            "IdentityUrlHC": "http://identity-api.eshop.svc.cluster.local/hc",
            "PaymentUrlHC": "http://localhost:5555/hc",
        }
    });
    return configmap;
}

function deploy_deployment(configmap: ConfigMap, secret: Secret) {
    const labels = {
        app: app_name,
        component: "server"
    };
    const deployment = new Deployment(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
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
                        image: image,
                        ports: [{ name: 'http', containerPort: 80 }],
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

