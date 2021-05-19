import * as workloads from "./workloads";


const { deployment, ingress, service } = workloads.deploy();

export const url = ingress.spec.rules[0].host;
