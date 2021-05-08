
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";

export const namespace_name = "eshop"
export const image_registry = "ghcr.io/suraciii"
export const app_name = "identity-api"
export const image_name = "identity.api"
export const image_repo = `${image_registry}/${image_name}`
