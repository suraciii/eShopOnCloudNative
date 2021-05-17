import * as k8s from "@pulumi/kubernetes";
import { Service } from "@pulumi/kubernetes/core/v1";
import { team_name, app_name, service_name } from "./core";
import { ServiceMonitor } from "@pulumi/prometheus-operator-crds/monitoring/v1";

export function deploy(service: Service) {
    return deploy_service_monitor(service);
}

function deploy_service_monitor(service: Service) {
    return new ServiceMonitor(service_name, {
        metadata: {
            name: service_name,
            namespace: service.metadata.namespace,
            labels: {
                app: app_name,
                team: team_name
            }
        },
        spec: {
            selector: {
                matchLabels: service.metadata.labels
            },
            endpoints: [{
                port: "http",
                path: "/metrics",
                interval: "5s"
            }]
        }
    })
}
