import { PackageDescriptor } from "../Foundation/index.js";

export const renderingPackageDescriptor = new PackageDescriptor({
    id: "core.rendering",
    name: { value: "rendering", displayName: "Rendering Core" },
    description: "Plugin-scoped deterministic rendering of immutable notation score graphs.",
    version: "6.5.0",
    layer: "application",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.infrastructure.registries", kind: "required" },
        { target: "core.kernel", kind: "required" },
        { target: "core.notation", kind: "required" }
    ],
    capabilities: ["rendering-engine", "plugin-scoped-renderers", "deterministic-svg", "standalone-svg", "xml-escaping", "score-graph-input"],
    consumes: [{ id: "notation.score-graph", kind: "value" }],
    provides: [
        { id: "rendering.engine", kind: "service" },
        { id: "rendering.svg", kind: "renderer" }
    ],
    publicApi: [{ id: "core/Rendering/index.js", kind: "module" }],
    metadata: { tags: ["rendering", "svg", "score", "strategy"] }
});

export default renderingPackageDescriptor;
