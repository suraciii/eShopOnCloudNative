
export const team_name = "eshop";
export const namespace_name = "eshop";
export const image_registry = "ghcr.io/suraciii";
export const service_name = "webshoppingagg";

export const shared_labels = {
    team: team_name,
    service: service_name
}

export const app_name = service_name;
export const image_name = service_name;
export const image_repo = `${image_registry}/${image_name}`;
export const base_domain = "eshop.ichnb.com";
export const app_host = `agg.${base_domain}`;
