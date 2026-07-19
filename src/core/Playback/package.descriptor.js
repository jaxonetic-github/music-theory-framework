import { PackageDescriptor } from "../Foundation/index.js";

export const playbackPackageDescriptor = new PackageDescriptor({
    id: "core.playback",
    name: { value: "playback", displayName: "Playback Planning Core" },
    description: "Deterministic immutable musical scheduling of notation score graphs without audio or device APIs.",
    version: "7.3.0",
    layer: "application",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.infrastructure.registries", kind: "required" },
        { target: "core.kernel", kind: "required" },
        { target: "core.theory", kind: "required" },
        { target: "core.notation", kind: "required" }
    ],
    capabilities: ["playback-planning", "exact-tick-timing", "tempo", "velocity", "polyphony", "plugin-scoped-strategies"],
    consumes: [{ id: "notation.score-graph", kind: "value" }],
    provides: [
        { id: "playback.engine", kind: "service" },
        { id: "playback.strategyRegistry", kind: "service" },
        { id: "playback.score", kind: "playback" },
        { id: "playback.plan", kind: "value" }
    ],
    publicApi: [{ id: "core/Playback/index.js", kind: "module" }],
    metadata: { tags: ["playback", "planning", "scheduling", "ticks", "headless"] }
});

export default playbackPackageDescriptor;
