import * as workloads from "./workloads";
import * as monitoring from "./monitoring";
import { app_name_api } from "./core";


const { deployment_api, service_api } = workloads.deploy();
monitoring.deploy(app_name_api, service_api);

export const image = deployment_api.spec.template.spec.containers[0].image;
