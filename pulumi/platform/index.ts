import * as core from "./core";
import * as mssql from "./mssql";
import * as redis from "./redis";
import * as rabbitmq from "./rabbitmq";
import * as monitoring from "./monitoring";
import * as thanos from "./monitoring-thanos";

const c = core.deploy();
export const kubeconfig = c.kubeconfig;
mssql.deploy(c.namespace);
redis.deploy(c.namespace);
rabbitmq.deploy(c.namespace);
const { object_storage_secret } = monitoring.deploy(c.namespace);
thanos.deploy(c.namespace, object_storage_secret);


