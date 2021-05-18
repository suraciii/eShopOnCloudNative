export const team_name = "eshop";
export const namespace_name = "eshop";
export const image_registry = "ghcr.io/suraciii";
export const service_name = "catalog";

export const shared_labels = {
    team: team_name,
    service: service_name
}

export const app_name_api = "catalog-api";
export const image_name_api = "catalog.api";
export const image_repo_api = `${image_registry}/${image_name_api}`;
