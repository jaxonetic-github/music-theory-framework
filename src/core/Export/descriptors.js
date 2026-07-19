import { ExporterDescriptor, PluginDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const exportServiceDescriptors = Object.freeze({
    engine: new ServiceDescriptor({
        id: "export.engine", name: { value: "export-engine", displayName: "Export Engine" },
        description: "Selects plugin-scoped exporter strategies for immutable score graphs.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        capabilities: ["exporter-strategy-selection", "format-validation", "immutable-export-results"]
    }),
    strategies: new ServiceDescriptor({
        id: "export.strategy-registry", name: { value: "exporter-strategy-registry", displayName: "Exporter Strategy Registry" },
        description: "Stores exporter strategies in isolated plugin scopes.",
        layer: "application", category: "application", role: "registry", stability: "stable", visibility: "public",
        capabilities: ["plugin-scoped-strategies", "deterministic-strategy-selection"]
    })
});

export const defaultExportPluginDescriptor = new PluginDescriptor({
    id: "core.export.musicxml", name: { value: "musicxml-export", displayName: "Default MusicXML Export" },
    description: "Default deterministic MusicXML 4.0 score exporter.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["musicxml-4", "score-partwise", "exact-rational-durations", "xml-escaping"],
    services: [{ id: "export.engine", kind: "service" }],
    extensionPoints: [{ id: "export.strategy", kind: "exporter" }]
});

export const exportExporterDescriptors = Object.freeze({
    musicxml: new ExporterDescriptor({
        id: "export.musicxml", name: { value: "musicxml-exporter", displayName: "MusicXML Exporter" },
        description: "Exports immutable score graphs as deterministic MusicXML 4.0 score-partwise documents.",
        layer: "application", category: "application", role: "strategy", stability: "stable", visibility: "public",
        formats: ["musicxml"], inputTypes: [{ id: "notation.score-graph", kind: "value" }],
        metadata: { pluginId: "core.export.musicxml", mediaType: "application/vnd.recordare.musicxml+xml", extension: "musicxml" }
    })
});
