
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

const name = "rabbitmq";
export function deploy(namespace: k8s.core.v1.Namespace) {
    const rabbitmq_password = new random.RandomPassword("rabbitmq_password", {
        length: 8,
        special: false
    });
    const rabbitmq = new k8s.helm.v3.Chart(name, {
        repo: "bitnami",
        chart: name,
        namespace: namespace.metadata.name,
        values: {
            auth: {
                password: rabbitmq_password.result
            },
            persistence: {
                enabled: false
            }
        }
    });
    return rabbitmq;
}
