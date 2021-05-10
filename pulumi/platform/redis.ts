
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

const name = "redis";
export function deploy(namespace: k8s.core.v1.Namespace) {
    const redis_password = new random.RandomPassword("redis_password", {
        length: 8,
        special: false
    });
    const redis = new k8s.helm.v3.Chart(name, {
        repo: "bitnami",
        chart: name,
        namespace: namespace.metadata.name,
        values: {
            global: {
                redis: {
                    password: redis_password.result
                }
            },
            architecture: "standalone",
            master: {
                persistence: { enabled: false }
            }
        }
    });
    return redis;
}
