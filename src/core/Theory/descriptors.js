import { GeneratorDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const theoryServiceDescriptors = Object.freeze({
    scaleCatalog: new ServiceDescriptor({
        id: "theory.scale-catalog", name: { value: "scale-catalog", displayName: "Scale Catalog" },
        description: "Catalog of validated scale interval patterns.", layer: "domain", category: "domain",
        role: "catalog", stability: "stable", visibility: "public", capabilities: ["scale-pattern-lookup"]
    }),
    chordCatalog: new ServiceDescriptor({
        id: "theory.chord-catalog", name: { value: "chord-catalog", displayName: "Chord Catalog" },
        description: "Catalog of validated chord interval patterns.", layer: "domain", category: "domain",
        role: "catalog", stability: "stable", visibility: "public", capabilities: ["chord-pattern-lookup"]
    })
});

export const theoryGeneratorDescriptors = Object.freeze({
    scale: new GeneratorDescriptor({
        id: "theory.scale-generator", name: { value: "scale-generator", displayName: "Scale Generator" },
        description: "Generates scales and pitched scale notes from roots and patterns.", layer: "domain", category: "domain",
        role: "factory", stability: "stable", visibility: "public", capabilities: ["scale-generation", "scale-note-generation"],
        inputTypes: [{ id: "theory.pitch-class", kind: "value" }, { id: "theory.scale-pattern", kind: "value" }],
        outputTypes: [{ id: "theory.scale", kind: "value" }]
    }),
    chord: new GeneratorDescriptor({
        id: "theory.chord-generator", name: { value: "chord-generator", displayName: "Chord Generator" },
        description: "Generates chords and voiced chord notes from roots and patterns.", layer: "domain", category: "domain",
        role: "factory", stability: "stable", visibility: "public", capabilities: ["chord-generation", "chord-note-generation"],
        inputTypes: [{ id: "theory.pitch-class", kind: "value" }, { id: "theory.chord-pattern", kind: "value" }],
        outputTypes: [{ id: "theory.chord", kind: "value" }]
    })
});
