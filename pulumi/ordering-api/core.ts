
export const team_name = "eshop";
export const namespace_name = "eshop";
export const image_registry = "ghcr.io/suraciii";
export const service_name = "ordering";

export const shared_labels = {
    team: team_name,
    service: service_name
}

export const app_name_api = "ordering-api";
export const image_name_api = "ordering.api";
export const image_repo_api = `${image_registry}/${image_name_api}`;

export const app_name_bgt = "ordering-backgroundtasks";
export const image_name_bgt = "ordering.backgroundtasks";
export const image_repo_bgt = `${image_registry}/${image_name_bgt}`;

export const app_name_hub = "ordering-signalrhub";
export const image_name_hub = "ordering.signalrhub";
export const image_repo_hub = `${image_registry}/${image_name_hub}`;
