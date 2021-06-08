import { Namespace, Secret, ServiceAccount } from "@pulumi/kubernetes/core/v1";
import { Role, RoleBinding } from "@pulumi/kubernetes/rbac/v1";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export const team_name = "eshop";
export const namespace_name = "eshop";

export function deploy() {
    const { namespace, service_account } = setup_namespace(namespace_name);
    const kubeconfig = getKubeconfig(service_account, namespace_name);
    const image_pull_secret = create_image_pull_secret(namespace);

    return { namespace, kubeconfig, image_pull_secret };
}


function setup_namespace(name: string) {
    const namespace = new Namespace(name, {
        metadata: {
            name: name,
            labels: {
                team: "eshop"
            }
        }
    });
    const service_account = createNamespaceAdminServiceAccount(name, namespace);
    return { namespace, service_account };
}

function getKubeconfig(sa: ServiceAccount, name: string): pulumi.Output<string> {
    const sa_secret = sa.secrets[0];
    const server_url = config.requireSecret("kubernetes_server_url");
    const secret_data = sa_secret.apply(v => Secret.get(v.name, `${name}/${v.name}`).data);
    const ca_data = secret_data["ca.crt"];
    const token_data = secret_data["token"].apply(v => Buffer.from(v, "base64").toString());
    return _getKubeconfig(server_url, ca_data, token_data);
}

function _getKubeconfig(server_url: pulumi.Output<string>, crt_data: pulumi.Output<string>, token: pulumi.Output<string>): pulumi.Output<string> {
    const kubeconfig_content = pulumi.interpolate`
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${crt_data}
    server: ${server_url}
  name: default-cluster
contexts:
- context:
    cluster: default-cluster
    user: default-user
  name: default-context
current-context: default-context
kind: Config
preferences: {}
users:
- name: default-user
  user:
    token: ${token}
`;
    return kubeconfig_content;
}

function createNamespaceAdminServiceAccount(name: string, namespace: Namespace) {
    const service_account = new ServiceAccount(`${name}-admin`, {
        metadata: {
            name: `${name}-admin`,
            namespace: namespace.metadata.name
        }
    });
    const subject = {
        kind: service_account.kind,
        name: service_account.metadata.name,
        namespace: service_account.metadata.namespace
    };
    const crb = new RoleBinding(`${name}-admin`, {
        metadata: { name: `${name}-admin`, namespace: name },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: "ClusterRole",
            name: "admin",
        },
        subjects: [subject]
    });

    const monitoring_manager_role = new Role("monitoring-manager", {
        metadata: {
            name: "monitoring-manager",
            namespace: subject.namespace
        },
        rules: [{
            apiGroups: ["monitoring.coreos.com"],
            resources: ["servicemonitors", "prometheusrules"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
        }]
    });
    const monitoring_manager_role_binding = new RoleBinding("monitoring-manager", {
        metadata: {
            name: "monitoring-manager",
            namespace: subject.namespace
        },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: monitoring_manager_role.kind,
            name: monitoring_manager_role.metadata.name
        },
        subjects: [subject]
    });

    return service_account;
}

function create_image_pull_secret(namespace: Namespace) {
    const cr_pat = config.requireSecret("CR_PAT");
    const dockerconfigjson = cr_pat.apply(v =>
        JSON.stringify({
            auths: {
                "ghcr.io": {
                    username: 'ci',
                    password: v
                }
            }
        })
    )
    const image_pull_secret = new Secret("image-pull-secret", {
        metadata: {
            namespace: namespace.metadata.name,
            name: "image-pull-secret"
        },
        type: "kubernetes.io/dockerconfigjson",
        stringData: {
            ".dockerconfigjson": dockerconfigjson,
        }
    });
    return image_pull_secret;
}
