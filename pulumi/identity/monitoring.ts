import { Service } from "@pulumi/kubernetes/core/v1";
import { PrometheusRule, ServiceMonitor } from "@pulumi/prometheus-operator-crds/monitoring/v1";

export function deploy(name: string, service: Service) {
    return {
        service_monitor: deploy_service_monitor(name, service),
        prometheus_rule: deploy_prometheus_rule(name, service)
    }
}

export function deploy_service_monitor(name: string, service: Service) {
    const service_monitor = new ServiceMonitor(name, {
        metadata: {
            name: service.metadata.name,
            namespace: service.metadata.namespace,
            labels: service.metadata.labels
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
    });
    return service_monitor;
}

function deploy_prometheus_rule(name: string, service: Service) {
    const rule = new PrometheusRule(name, {
        metadata: {
            name: service.metadata.name,
            namespace: service.metadata.namespace,
            labels: service.metadata.labels
        },
        spec: {
            groups: [{
                name: "DotNetRuntime",
                rules: [{
                    alert: "IdentityServiceThreadQueueTooLong",
                    annotations: {
                        "summary": "IdentityService Thread Queue Too Long"
                    },
                    expr: `
                    (sum(rate(dotnet_threadpool_queue_length_sum{service="${name}"}[20s])) 
                        /
                    sum(rate(dotnet_threadpool_queue_length_count{service="${name}"}[20s])))
                    > 0
                    `,
                    for: "5m",
                    labels: {
                        severity: "warning"
                    }
                }]
            }]
        }
    });
    return rule;
}
