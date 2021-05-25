import * as workloads from "./workloads";

const { job } = workloads.deploy();

export const image = job.spec.template.spec.containers[0].image;
