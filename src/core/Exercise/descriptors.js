import { ExerciseDescriptor, PluginDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const exerciseServiceDescriptors = Object.freeze({
    engine: new ServiceDescriptor({
        id: "exercise.engine", name: { value: "exercise-engine", displayName: "Exercise Engine" },
        description: "Selects plugin-scoped strategies that compose Theory capabilities into semantic exercise models.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        capabilities: ["exercise-generation", "deterministic-selection", "semantic-output"]
    }),
    strategies: new ServiceDescriptor({
        id: "exercise.strategy-registry", name: { value: "exercise-strategy-registry", displayName: "Exercise Strategy Registry" },
        description: "Stores deterministic exercise generation strategies in isolated plugin scopes.",
        layer: "application", category: "application", role: "registry", stability: "stable", visibility: "public",
        capabilities: ["plugin-scoped-strategies", "deterministic-strategy-selection"]
    })
});

export const defaultExercisePluginDescriptor = new PluginDescriptor({
    id: "core.exercise.foundational", name: { value: "foundational-exercises", displayName: "Foundational Exercise Generator" },
    description: "Default semantic scale, thirds, arpeggio, and chord exercise generation.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["scale-exercises", "scale-thirds", "arpeggios", "blocked-chords", "broken-chords"],
    services: [{ id: "exercise.engine", kind: "service" }], extensionPoints: [{ id: "exercise.strategy", kind: "exercise" }]
});

export const exerciseStrategyDescriptors = Object.freeze({
    foundational: new ExerciseDescriptor({
        id: "exercise.foundational", name: { value: "foundational-exercise-generator", displayName: "Foundational Exercise Generator" },
        description: "Composes existing Theory generators into deterministic immutable semantic exercise models.",
        layer: "application", category: "application", role: "strategy", stability: "stable", visibility: "public",
        capabilities: ["semantic-exercise-generation", "all-keys", "enharmonic-preservation", "immutable-model-output"],
        plugin: { id: "core.exercise.foundational", kind: "plugin" },
        inputTypes: [{ id: "exercise.request", kind: "value" }], outputTypes: [{ id: "exercise.model", kind: "value" }],
        metadata: { pluginId: "core.exercise.foundational", notationOutput: false, playbackOutput: false }
    })
});
