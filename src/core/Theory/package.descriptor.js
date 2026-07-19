import { PackageDescriptor } from "../Foundation/index.js";

export const theoryPackageDescriptor = new PackageDescriptor({
    id: "core.theory",
    name: { value: "theory", displayName: "Theory Domain and Generation Core" },
    description: "Immutable music-theory values, pattern catalogs, and scale and chord generation services.",
    version: "6.1.0",
    layer: "domain",
    category: "domain",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.infrastructure.registries", kind: "required" },
        { target: "core.kernel", kind: "required" }
    ],
    capabilities: ["pitch-modeling", "intervals", "scale-generation", "chord-generation", "pattern-catalogs"],
    provides: [
        { id: "theory.scale-generator", kind: "generator" },
        { id: "theory.chord-generator", kind: "generator" }
    ],
    publicApi: [{ id: "core/Theory/index.js", kind: "module" }],
    metadata: { tags: ["theory", "domain", "generation"] }
});

export default theoryPackageDescriptor;
