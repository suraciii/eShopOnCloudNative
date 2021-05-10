
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

const name = "mssql";
export const mssql_secret_name = "mssql-secret";
export function deploy(namespace: k8s.core.v1.Namespace) {
    const secret = deploy_secret(namespace);
    const configmap = deploy_configmap(namespace);
    const pvc = deploy_pvc(namespace);
    const deploy = deploy_deployment(namespace, secret, pvc, configmap);
    const svc = deploy_svc(namespace, deploy);
    return svc;
}

function deploy_secret(namespace: k8s.core.v1.Namespace) {
    const mssql_sa_password = new random.RandomPassword("mssql_sa_password", {
        length: 8,
        special: false
    });
    const mssql_secret = new k8s.core.v1.Secret(mssql_secret_name, {
        metadata: {
            namespace: namespace.metadata.name,
            name: mssql_secret_name
        },
        type: "Opaque",
        stringData: {
            "sa_password": mssql_sa_password.result,
        }
    });
    return mssql_secret;
}

function deploy_configmap(namespace: k8s.core.v1.Namespace) {
    const config_content = `
[EULA]
accepteula = Y
accepteulaml = Y

[coredump]
captureminiandfull = true
coredumptype = full

[hadr]
hadrenabled = 0

[language]
lcid = 1033

[filelocation]
defaultdatadir = /var/opt/mssql/userdata
defaultlogdir = /var/opt/mssql/userlog
`
    const configmap = new k8s.core.v1.ConfigMap("mssql-config", {
        metadata: {
            namespace: namespace.metadata.name,
            name: "mssql-config"
        },
        data: {
            "mssql.conf": config_content
        }
    });
    return configmap;
}

function deploy_pvc(namespace: k8s.core.v1.Namespace) {
    const pvc = new k8s.core.v1.PersistentVolumeClaim("mssql-data", {
        metadata: {
            name: "mssql-data",
            namespace: namespace.metadata.name
        },
        spec: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "alicloud-disk-ssd",
            resources: { requests: { storage: "100Gi" } }
        }
    });
    return pvc;
}

function deploy_deployment(namespace: k8s.core.v1.Namespace, mssql_secret: k8s.core.v1.Secret, pvc: k8s.core.v1.PersistentVolumeClaim, mssql_config: k8s.core.v1.ConfigMap) {
    const deployment = new k8s.apps.v1.Deployment(name, {
        metadata: {
            name: name,
            namespace: namespace.metadata.name,
            labels: {
                app: name
            }
        },
        spec: {
            selector: {
                matchLabels: {
                    app: name
                }
            },
            template: {
                metadata: {
                    labels: {
                        app: name
                    }
                },
                spec: {
                    hostname: "mssql",
                    securityContext: { fsGroup: 10001 },
                    containers: [{
                        name: name,
                        image: "mcr.microsoft.com/mssql/server:2019-latest",
                        ports: [{ containerPort: 1433 }],
                        env: [{
                            name: "MSSQL_PID",
                            value: "Developer"
                        }, {
                            name: "ACCEPT_EULA",
                            value: "Y"
                        }, {
                            name: "MSSQL_AGENT_ENABLED",
                            value: "false"
                        }, {
                            name: "SA_PASSWORD",
                            valueFrom: {
                                secretKeyRef: {
                                    name: mssql_secret.metadata.name,
                                    key: "sa_password"
                                }
                            }
                        }],
                        volumeMounts: [{
                            name: "mssql-data",
                            mountPath: "/var/opt/mssql"
                        }, {
                            name: "mssql-config-volume",
                            mountPath: "/var/opt/config"
                        }]
                    }],
                    volumes: [{
                        name: "mssql-data",
                        persistentVolumeClaim: {
                            claimName: pvc.metadata.name
                        }
                    }, {
                        name: "mssql-config-volume",
                        configMap: {
                            name: mssql_config.metadata.name
                        }
                    }]
                }
            }
        }
    });
    return deployment;
}

function deploy_svc(namespace: k8s.core.v1.Namespace, deployment: k8s.apps.v1.Deployment) {
    const svc = new k8s.core.v1.Service(name, {
        metadata: {
            name: name,
            namespace: namespace.metadata.name,
            labels: {
                "app": name
            }
        },
        spec: {
            ports: [{ port: 1433 }],
            selector: deployment.spec.template.metadata.labels,
        }
    });
    return svc;
}

