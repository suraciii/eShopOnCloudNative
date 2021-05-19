import * as pulumi from "@pulumi/pulumi";
import { ConfigMap, Secret, Service, ServiceSpecType } from "@pulumi/kubernetes/core/v1";
import { service_name, namespace_name, spa_url, shared_labels, app_name_api, image_repo_api, path_base, base_domain, team_name } from "./core";
import { Job } from "@pulumi/kubernetes/batch/v1";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Ingress } from "@pulumi/kubernetes/networking/v1beta1";

const config = new pulumi.Config();
const image_version = process.env["IMAGE_VERSION"];
if (!image_version) { throw "missing IMAGE_VERSION" };
const image = `${image_repo_api}:linux-${image_version}`;

export function deploy() {
    const secret = deploy_secret();
    const configmap = deploy_configmap();
    const job = deploy_migration_job(configmap, secret);
    const { deployment, service } = deploy_app(app_name_api, image, configmap, secret, job);
    const ingress = deploy_ingress(service);
    return { deployment, service, ingress }
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
            "DPConnectionString": config.requireSecret("DPConnectionString")
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
            "SpaClient": spa_url
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
                        image: image,
                        imagePullPolicy: "Always",
                        args: ["dotnet", "Identity.API.dll", "seed"],
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
                        imagePullPolicy: "Always",
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

function deploy_ingress(service: Service) {
    return new Ingress(service_name, {
        metadata: {
            name: service_name,
            namespace: namespace_name,
            labels: shared_labels,
            annotations: {
                "cert-manager.io/cluster-issuer": "letsencrypt",
                "nginx.ingress.kubernetes.io/proxy-buffers-number": "8",
                "nginx.ingress.kubernetes.io/proxy-buffer-size": "16k"
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
                                path: path_base,
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

