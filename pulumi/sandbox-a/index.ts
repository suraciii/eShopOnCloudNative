import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as core from "./core";
import * as workloads from "./workloads";


const { deployment, ingress } = workloads.deploy();

export const image = deployment.spec.template.spec.containers[0].image;
export const url = ingress.spec.rules[0].host;
