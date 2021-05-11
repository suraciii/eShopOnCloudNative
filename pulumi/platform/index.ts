import * as core from "./core";
import * as mssql from "./mssql";
import * as redis from "./redis";
import * as monitoring from "./monitoring";

const c = core.deploy();
export const kubeconfig = c.kubeconfig;
mssql.deploy(c.namespace);
redis.deploy(c.namespace);
monitoring.deploy(c.namespace);

