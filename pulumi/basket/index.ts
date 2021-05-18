import * as workloads from "./workloads";
import * as monitoring from "./monitoring";
import { app_name_api } from "./core";


const { deployment, service } = workloads.deploy();
monitoring.deploy(app_name_api, service);

export const image = deployment.spec.template.spec.containers[0].image;
