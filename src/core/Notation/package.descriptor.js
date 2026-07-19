import { PackageDescriptor } from "../Foundation/index.js";

export const notationPackageDescriptor = new PackageDescriptor({
    id: "core.notation",
    name: { value: "notation", displayName: "Notation Core and ScoreGraph" },
    description: "Immutable score-domain graphs and plugin-scoped notation strategies for generated theory models.",
    version: "6.1.0",
    layer: "application",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.infrastructure.registries", kind: "required" },
        { target: "core.kernel", kind: "required" },
        { target: "core.theory", kind: "required" }
    ],
    capabilities: ["score-graph", "notation-engine", "plugin-scoped-strategies", "scale-notation", "chord-notation"],
    provides: [
        { id: "notation.engine", kind: "service" },
        { id: "notation.scale", kind: "renderer" },
        { id: "notation.chord", kind: "renderer" }
    ],
    publicApi: [{ id: "core/Notation/index.js", kind: "module" }],
    metadata: { tags: ["notation", "score", "graph", "rendering"] }
});

export default notationPackageDescriptor;
