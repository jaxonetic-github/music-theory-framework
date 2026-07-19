import { PackageDescriptor } from "../core/index.js";

export const reactWebPackageDescriptor = new PackageDescriptor({
    id: "web.react-application",
    name: { value: "react-web-application", displayName: "React Web Application Adapter" },
    description: "Accessible React adapter over the headless music theory application workflow.",
    version: "7.2.0",
    layer: "presentation",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.theory", kind: "required" },
        { target: "core.notation", kind: "required" },
        { target: "core.rendering", kind: "required" },
        { target: "core.export", kind: "required" },
        { target: "core.application", kind: "required" }
    ],
    capabilities: ["react-adapter", "accessible-workflow", "trusted-svg-view", "musicxml-download", "responsive-layout"],
    consumes: [
        { id: "application.engine", kind: "service" },
        { id: "theory.scaleCatalog", kind: "service" },
        { id: "theory.chordCatalog", kind: "service" }
    ],
    provides: [{ id: "web.react-application", kind: "module" }],
    publicApi: [{ id: "web/index.js", kind: "module" }],
    metadata: { tags: ["web", "react", "accessibility", "adapter"] }
});

export default reactWebPackageDescriptor;
