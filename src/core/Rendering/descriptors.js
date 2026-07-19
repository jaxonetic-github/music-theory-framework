import { PluginDescriptor, RendererDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const renderingServiceDescriptors = Object.freeze({
    engine: new ServiceDescriptor({
        id: "rendering.engine", name: { value: "rendering-engine", displayName: "Rendering Engine" },
        description: "Selects plugin-scoped renderer strategies for immutable score graphs.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        capabilities: ["renderer-strategy-selection", "score-graph-rendering", "deterministic-output"]
    }),
    strategies: new ServiceDescriptor({
        id: "rendering.strategy-registry", name: { value: "renderer-strategy-registry", displayName: "Renderer Strategy Registry" },
        description: "Stores renderer strategies in isolated plugin scopes.",
        layer: "application", category: "application", role: "registry", stability: "stable", visibility: "public",
        capabilities: ["plugin-scoped-strategies", "deterministic-strategy-selection"]
    })
});

export const defaultRenderingPluginDescriptor = new PluginDescriptor({
    id: "core.rendering.svg", name: { value: "svg-rendering", displayName: "Default SVG Rendering" },
    description: "Default standalone SVG score renderer.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["svg", "score-rendering", "xml-escaping", "server-safe-rendering"],
    services: [{ id: "rendering.engine", kind: "service" }],
    extensionPoints: [{ id: "rendering.strategy", kind: "renderer" }]
});

export const renderingRendererDescriptors = Object.freeze({
    svg: new RendererDescriptor({
        id: "rendering.svg", name: { value: "svg-score-renderer", displayName: "SVG Score Renderer" },
        description: "Renders immutable score graphs as deterministic standalone SVG strings.",
        layer: "application", category: "application", role: "strategy", stability: "stable", visibility: "public",
        formats: ["svg"], inputTypes: [{ id: "notation.score-graph", kind: "value" }],
        outputTypes: [{ id: "rendering.svg-string", kind: "value" }],
        metadata: { pluginId: "core.rendering.svg", browserRequired: false }
    })
});
