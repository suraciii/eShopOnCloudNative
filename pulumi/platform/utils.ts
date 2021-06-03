export function labels_without_version<Labels extends { "app.kubernetes.io/version": string }>(labels: Labels)
    : Omit<Labels, "app.kubernetes.io/version"> {
    const { ["app.kubernetes.io/version"]: _, ...o } = labels;
    return o;
}
