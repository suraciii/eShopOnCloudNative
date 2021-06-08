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
                name: "ServicePerformance",
                rules: [{
                    alert: "SLOFailed",
                    annotations: {
                        "summary": "BasketService has p95 requests with latency > 300ms"
                    },
                    expr: `
                    histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="basket-api"}[1m])) by (le))
                    `,
                    for: "1m",
                    labels: {
                        severity: "warning"
                    }
                }]
            }]
        }
    });
    return rule;
}
