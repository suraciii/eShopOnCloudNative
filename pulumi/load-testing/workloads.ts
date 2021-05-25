import { Job } from "@pulumi/kubernetes/batch/v1";
import { namespace_name, image_repo, shared_labels, app_name, } from "./core";

const image_version = process.env["IMAGE_VERSION"];
if (!image_version) { throw "missing IMAGE_VERSION" };
const image = `${image_repo}:linux-${image_version}`;

export function deploy() {
    const job = deploy_job()
    return { job };
}

function deploy_job() {
    const job_name = `${app_name}`;
    const labels = {
        app: job_name,
        ...shared_labels
    };
    const job = new Job(job_name, {
        metadata: {
            name: job_name,
            namespace: namespace_name,
            labels: labels
        },
        spec: {
            template: {
                metadata: {
                    labels: labels
                },
                spec: {
                    imagePullSecrets: [{ name: "image_pull_secret" }],
                    restartPolicy: "Never",
                    containers: [{
                        name: job_name,
                        image: image,
                        args: ["k9", "run", "dist/index.js"],
                    }]
                }
            }
        }
    });
    return job;
}