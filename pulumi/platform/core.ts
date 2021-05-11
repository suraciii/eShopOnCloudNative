
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";

export const team_name = "eshop";
export const namespace_name = "eshop";

export function deploy() {
    const { namespace, service_account } = setup_namespace(namespace_name);
    const kubeconfig = getKubeconfig(service_account, namespace_name);

    return { namespace, kubeconfig };
}


function setup_namespace(name: string) {
    const namespace = new k8s.core.v1.Namespace(name, {
        metadata: {
            name: name,
            labels: {
                team: "eshop"
            }
        }
    });
    const service_account = createNamespaceAdminServiceAccount(name);
    return { namespace, service_account };
}

function getKubeconfig(sa: k8s.core.v1.ServiceAccount, name: string): pulumi.Output<string> {
    const config = new pulumi.Config();
    const sa_secret = sa.secrets[0];
    const server_url = config.requireSecret("kubernetes_server_url");
    const secret_data = sa_secret.apply(v => k8s.core.v1.Secret.get(v.name, `${name}/${v.name}`).data);
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

function createNamespaceAdminServiceAccount(name: string) {
    const sa = new k8s.core.v1.ServiceAccount(`${name}-admin`, {
        metadata: { name: `${name}-admin`, namespace: name }
    });
    const crb = new k8s.rbac.v1.RoleBinding(`${name}-admin`, {
        metadata: { name: `${name}-admin`, namespace: name },
        roleRef: {
            apiGroup: "rbac.authorization.k8s.io",
            kind: "ClusterRole",
            name: "admin",
        },
        subjects: [
            {
                kind: "ServiceAccount",
                name: sa.metadata.name,
                namespace: name
            }
        ]
    });
    return sa;
}