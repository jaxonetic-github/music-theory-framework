import { PluginDescriptor, RendererDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const notationServiceDescriptors = Object.freeze({
    engine: new ServiceDescriptor({
        id: "notation.engine", name: { value: "notation-engine", displayName: "Notation Engine" },
        description: "Selects plugin-scoped notation strategies and produces validated score graphs.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        capabilities: ["notation-strategy-selection", "score-graph-generation", "theory-graph-conversion", "enharmonic-preservation", "rests", "clefs", "key-signatures"]
    }),
    strategies: new ServiceDescriptor({
        id: "notation.strategy-registry", name: { value: "notation-strategy-registry", displayName: "Notation Strategy Registry" },
        description: "Stores notation strategies in isolated plugin scopes.",
        layer: "application", category: "application", role: "registry", stability: "stable", visibility: "public",
        capabilities: ["plugin-scoped-strategies", "deterministic-strategy-selection"]
    })
});

export const defaultNotationPluginDescriptor = new PluginDescriptor({
    id: "core.notation.defaults", name: { value: "notation-defaults", displayName: "Default Notation Strategies" },
    description: "Default scale and chord notation strategies.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["scale-notation", "chord-notation"],
    services: [{ id: "notation.engine", kind: "service" }],
    extensionPoints: [{ id: "notation.strategy", kind: "renderer" }]
});

export const notationRendererDescriptors = Object.freeze({
    scale: new RendererDescriptor({
        id: "notation.scale", name: { value: "scale-notation", displayName: "Scale Notation Strategy" },
        description: "Converts generated scales into sequential note score graphs.",
        layer: "application", category: "application", role: "strategy", stability: "stable", visibility: "public",
        formats: ["score-graph"], inputTypes: [
            { id: "theory.generation-result", kind: "value" }, { id: "theory.graph", kind: "value" }
        ],
        outputTypes: [{ id: "notation.score-graph", kind: "value" }], metadata: { pluginId: "core.notation.defaults" }
    }),
    chord: new RendererDescriptor({
        id: "notation.chord", name: { value: "chord-notation", displayName: "Chord Notation Strategy" },
        description: "Converts generated chords into chord-event score graphs.",
        layer: "application", category: "application", role: "strategy", stability: "stable", visibility: "public",
        formats: ["score-graph"], inputTypes: [
            { id: "theory.generation-result", kind: "value" }, { id: "theory.graph", kind: "value" }
        ],
        outputTypes: [{ id: "notation.score-graph", kind: "value" }], metadata: { pluginId: "core.notation.defaults" }
    })
});
