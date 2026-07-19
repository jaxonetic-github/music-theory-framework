import { PluginDescriptor, ServiceDescriptor } from "../../core/index.js";

export const playbackTransportServiceDescriptor = new ServiceDescriptor({
    id: "web.playback.transport", name: { value: "playback-transport", displayName: "Playback Transport Controller" },
    description: "Coordinates PlaybackPlan execution and immutable browser transport state without scheduling audio.",
    layer: "presentation", category: "application", role: "service", stability: "stable", visibility: "public",
    capabilities: ["playback-orchestration", "transport-state", "stale-operation-protection", "session-observation"],
    contracts: [{ id: "playback.plan", kind: "value" }, { id: "web.audio.playback", kind: "service" }],
    metadata: { attributes: { browserScoped: true, playbackPlanner: false, renderer: false, react: false } }
});

export const playbackTransportPluginDescriptor = new PluginDescriptor({
    id: "web.playback.transport", name: { value: "playback-transport", displayName: "Playback Transport" },
    description: "UI-neutral browser transport orchestration for Web Audio playback sessions.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["playback-orchestration", "session-ownership", "immutable-snapshots"],
    services: [{ id: "web.playback.transport", kind: "service" }],
    extensionPoints: [{ id: "web.playback.transport-controller", kind: "service" }]
});
