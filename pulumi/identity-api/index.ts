import * as workloads from "./workloads";
import * as monitoring from "./monitoring";


const { deployment, ingress, service } = workloads.deploy();
monitoring.deploy(service);

export const image = deployment.spec.template.spec.containers[0].image;
export const url = ingress.spec.rules[0].host;
