import * as k8s from "@pulumi/kubernetes";
import { Service } from "@pulumi/kubernetes/core/v1";
import { team_name, app_name, service_name } from "./core";
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
                        "summary": `Service has p95 requests with latency > 300ms`
                    },
                    expr: `
                    histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="${app_name}"}[1m])) by (le))
                    > 0.3
                    `,
                    for: "1m",
                    labels: {
                        severity: "warning"
                    }
                }, {
                    alert: "HttpErrorRateTooHigh",
                    annotations: {
                        "summary": "Http Request with 5xx > 10%"
                    },
                    expr: `
                    (sum(rate(http_requests_received_total{code=~"5..", service="${app_name}"}[1m]))
                    /
                    sum(rate(http_requests_received_total{service="${app_name}"}[1m])))
                    > 0.1
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
