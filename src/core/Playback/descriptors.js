import { PluginDescriptor, RendererDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const playbackServiceDescriptors = Object.freeze({
    engine: new ServiceDescriptor({
        id: "playback.engine", name: { value: "playback-engine", displayName: "Playback Planning Engine" },
        description: "Selects plugin-scoped strategies that create immutable playback plans from score graphs.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        capabilities: ["playback-planning", "deterministic-selection", "score-graph-input", "exact-tick-timing"]
    }),
    strategies: new ServiceDescriptor({
        id: "playback.strategy-registry", name: { value: "playback-strategy-registry", displayName: "Playback Strategy Registry" },
        description: "Stores playback planning strategies in isolated plugin scopes.",
        layer: "application", category: "application", role: "registry", stability: "stable", visibility: "public",
        capabilities: ["plugin-scoped-strategies", "deterministic-strategy-selection"]
    })
});

export const defaultPlaybackPluginDescriptor = new PluginDescriptor({
    id: "core.playback.score", name: { value: "score-playback", displayName: "Default Score Playback Planner" },
    description: "Default deterministic ScoreGraph-to-PlaybackPlan strategy.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["score-playback-plan", "rational-duration-timing", "polyphonic-scheduling", "enharmonic-preservation"],
    services: [{ id: "playback.engine", kind: "service" }],
    extensionPoints: [{ id: "playback.strategy", kind: "renderer" }]
});

export const playbackStrategyDescriptors = Object.freeze({
    score: new RendererDescriptor({
        id: "playback.score", name: { value: "score-playback-planner", displayName: "Score Playback Planner" },
        description: "Converts immutable score graphs into exact-tick immutable playback plans.",
        layer: "application", category: "application", role: "strategy", stability: "stable", visibility: "public",
        formats: ["playback-plan"],
        inputTypes: [{ id: "notation.score-graph", kind: "value" }],
        outputTypes: [{ id: "playback.plan", kind: "value" }],
        metadata: { pluginId: "core.playback.score", audioOutput: false, midiOutput: false }
    })
});
