import * as pulumi from "@pulumi/pulumi";
import { ConfigMap, Secret, Service, ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import { service_name, namespace_name, team_name, image_repo_api, shared_labels, app_name_api } from "./core";
import { Deployment } from "@pulumi/kubernetes/apps/v1";

const config = new pulumi.Config();
const image_version = process.env["IMAGE_VERSION"];
if (!image_version) { throw "missing IMAGE_VERSION" };
const image = `${image_repo_api}:linux-${image_version}`;

export function deploy() {
    const secret = deploy_secret();
    const configmap = deploy_configmap();
    const { deployment, service } = deploy_app(app_name_api, image, configmap, secret);
    return { deployment, service }
}

function deploy_secret() {
    const secret = new Secret(service_name, {
        metadata: {
            namespace: namespace_name,
            name: service_name,
            labels: shared_labels
        },
        type: "Opaque",
        stringData: {
            "ConnectionString": config.requireSecret("ConnectionString"),
            "EventBusConnection": config.requireSecret("EventBusConnection"),
            "EventBusUserName": config.requireSecret("EventBusUserName"),
            "EventBusPassword": config.requireSecret("EventBusPassword"),
        }
    });
    return secret;
}

function deploy_configmap() {
    const configmap = new ConfigMap(service_name, {
        metadata: {
            namespace: namespace_name,
            name: service_name,
            labels: shared_labels
        },
        data: {
            "IdentityUrl": "http://identity-api.eshop.svc.cluster.local",
        }
    });
    return configmap;
}

function deploy_app(app_name: string, image_name: string, configmap: ConfigMap, secret: Secret) {
    const labels: { [key: string]: string } = {
        app: app_name,
        ...shared_labels
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
                    labels: labels,
                    annotations: {
                        "linkerd.io/inject": "enabled"
                    }
                },
                spec: {
                    containers: [{
                        name: app_name,
                        image: image_name,
                        ports: [{
                            name: 'http',
                            containerPort: 80
                        }, {
                            name: 'grpc',
                            containerPort: 81
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
                            value: "/basket-api",
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

    const service = new Service(app_name, {
        metadata: {
            name: app_name,
            namespace: namespace_name,
            labels: {
                app: app_name,
                ...shared_labels
            }
        },
        spec: {
            ports: [{
                name: "http",
                port: 80
            }, {
                name: "grpc",
                port: 81
            }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.ClusterIP
        }
    });

    return { deployment, service };
}
