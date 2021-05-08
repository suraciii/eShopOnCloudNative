
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";

export const namespace_name = "eshop"
export const image_registry = "ghcr.io/suraciii"
export const app_name = "sandbox-b"
export const base_domain = "s.ichnb.com"
export const app_host = `${app_name}.${base_domain}`
export const image_name = "sandbox.b"
export const image_repo = `${image_registry}/${image_name}`
