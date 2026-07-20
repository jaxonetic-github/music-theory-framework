import { PackageDescriptor } from "../Foundation/index.js";

export const exercisePackageDescriptor = new PackageDescriptor({
    id: "core.exercise", name: { value: "exercise", displayName: "Exercise Model and Generation Core" },
    description: "Deterministic immutable semantic exercise material composed from Theory capabilities.",
    version: "8.4.0", layer: "application", category: "application", role: "provider", stability: "stable", visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" }, { target: "core.infrastructure.registries", kind: "required" },
        { target: "core.kernel", kind: "required" }, { target: "core.theory", kind: "required" }
    ],
    capabilities: ["exercise-generation", "semantic-music-material", "all-keys", "plugin-scoped-strategies", "approach-notes", "enclosures", "chord-progressions"],
    consumes: [{ id: "theory.scale-generator", kind: "generator" }, { id: "theory.chord-generator", kind: "generator" }],
    provides: [
        { id: "exercise.engine", kind: "service" }, { id: "exercise.strategy-registry", kind: "service" },
        { id: "exercise.progressionCatalog", kind: "service" }, { id: "exercise.foundational", kind: "exercise" },
        { id: "exercise.advanced", kind: "exercise" }, { id: "exercise.model", kind: "value" }
    ],
    publicApi: [{ id: "core/Exercise/index.js", kind: "module" }], metadata: { tags: ["exercise", "theory", "semantic", "headless"] }
});

export default exercisePackageDescriptor;
