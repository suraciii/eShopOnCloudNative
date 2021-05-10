import * as core from "./core";
import * as mssql from "./mssql";

const c = core.deploy();
export const kubeconfig = c.kubeconfig;
mssql.deploy(c.namespace);

