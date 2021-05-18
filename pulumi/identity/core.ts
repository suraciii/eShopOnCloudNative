export const team_name = "eshop";
export const namespace_name = "eshop";
export const image_registry = "ghcr.io/suraciii";
export const service_name = "identity";
export const base_domain = "eshop.ichnb.com";
export const app_host = `${service_name}.${base_domain}`;

export const shared_labels = {
    team: team_name,
    service: service_name
}

export const app_name_api = "identity-api";
export const image_name_api = "identity.api";
export const image_repo_api = `${image_registry}/${image_name_api}`;
export const spa_url = `https://${base_domain}`;
