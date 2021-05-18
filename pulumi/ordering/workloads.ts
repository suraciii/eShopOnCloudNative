import * as pulumi from "@pulumi/pulumi";
import { ConfigMap, Secret, Service, ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import { service_name, app_name_api, image_repo_api, namespace_name, team_name, app_name_bgt, image_repo_bgt, image_repo_hub, app_name_hub, shared_labels } from "./core";
import { Job } from "@pulumi/kubernetes/batch/v1";
import { Deployment } from "@pulumi/kubernetes/apps/v1";

const config = new pulumi.Config();
const image_version = process.env["IMAGE_VERSION"];
if (!image_version) { throw "missing IMAGE_VERSION" };
const image_api = `${image_repo_api}:linux-${image_version}`;
const image_bgt = `${image_repo_bgt}:linux-${image_version}`;
const image_hub = `${image_repo_hub}:linux-${image_version}`;

export function deploy() {
    const secret = deploy_secret();
    const configmap = deploy_configmap();
    const job = deploy_migration_job(configmap, secret);
    const { deployment: deployment_api, service: service_api } = deploy_app(app_name_api, image_api, configmap, secret, job);
    const { deployment: deployment_bgt, service: service_bgt } = deploy_app(app_name_bgt, image_bgt, configmap, secret, job);
    const { deployment: deployment_hub, service: service_hub } = deploy_app(app_name_hub, image_hub, configmap, secret, job);
    return { deployment_api, service_api };
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
            "SignalrStoreConnectionString": config.requireSecret("SignalrStoreConnectionString"),
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

function deploy_migration_job(configmap: ConfigMap, secret: Secret) {
    const job_name = `${service_name}-migration`;
    const labels = {
        app: job_name,
        ...shared_labels
    };
    const job = new Job(job_name, {
        metadata: {
            name: job_name,
            namespace: namespace_name,
            labels: labels
        },
        spec: {
            template: {
                metadata: {
                    labels: labels
                },
                spec: {
                    restartPolicy: "Never",
                    containers: [{
                        name: job_name,
                        image: image_api,
                        args: ["dotnet", "Ordering.API.dll", "seed"],
                        env: [{
                            name: "ASPNETCORE_ENVIRONMENT",
                            value: pulumi.getStack()
                        }],
                        envFrom: [{
                            secretRef: { name: secret.metadata.name }
                        }, {
                            configMapRef: { name: configmap.metadata.name }
                        }],
                    }]
                }
            }
        }
    });
    return job;
}

function deploy_app(app_name: string, image_name: string, configmap: ConfigMap, secret: Secret, migration_job: Job) {
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
                    labels: labels
                },
                spec: {
                    containers: [{
                        name: app_name,
                        image: image_name,
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
    }, { dependsOn: migration_job });

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
            ports: [{ name: "http", port: 80 }],
            selector: deployment.spec.template.metadata.labels,
            type: ServiceSpecType.ClusterIP
        }
    });

    return { deployment, service };
}