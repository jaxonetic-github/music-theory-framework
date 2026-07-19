import { PackageDescriptor } from "../Foundation/index.js";

export const exportPackageDescriptor = new PackageDescriptor({
    id: "core.export",
    name: { value: "export", displayName: "Export Core" },
    description: "Framework-neutral deterministic export of immutable notation score graphs.",
    version: "7.0.0",
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
    capabilities: ["export-engine", "plugin-scoped-exporters", "immutable-export-result", "musicxml-4", "score-graph-input", "exact-rational-durations"],
    consumes: [{ id: "notation.score-graph", kind: "value" }],
    provides: [
        { id: "export.engine", kind: "service" },
        { id: "export.musicxml", kind: "exporter" }
    ],
    publicApi: [{ id: "core/Export/index.js", kind: "module" }],
    metadata: { tags: ["export", "musicxml", "score", "strategy"] }
});

export default exportPackageDescriptor;
