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
    const job = deploy_migration_job(configmap, secret);
    const deployment = deploy_deployment(configmap, secret, job);
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
            "ConnectionString": config.requireSecret("ConnectionString"),
            "EventBusConnection": config.requireSecret("EventBusConnection"),
            "EventBusUserName": config.requireSecret("EventBusUserName"),
            "EventBusPassword": config.requireSecret("EventBusPassword"),
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
            "foo": "bar"
        }
    });
    return configmap;
}

function deploy_migration_job(configmap: ConfigMap, secret: Secret) {
    const job_name = `${service_name}-migration`;
    const labels = {
        app: app_name,
        component: "migration"
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
                        image: image,
                        args: ["dotnet", "Catalog.API.dll", "seed"],
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

function deploy_deployment(configmap: ConfigMap, secret: Secret, migration_job: Job) {
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
    }, { dependsOn: migration_job });
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

