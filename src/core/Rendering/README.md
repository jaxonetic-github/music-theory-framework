# Rendering Core

Rendering Core is the v6.5 boundary that turns an immutable Notation `ScoreGraph` into presentation output. It reads score, part, measure, voice, note, rest, and chord nodes without changing the graph or any contained notation or theory value.

## Engine and strategies

`RenderingEngine.render(scoreGraph, options)` selects a `RendererStrategy` through `RendererStrategyRegistry`. Strategies are registered inside plugin scopes, so independent plugins can use the same strategy id without colliding. Selection is deterministic: an explicit `pluginId` and `strategyId` selects that exact strategy, while implicit selection uses registration order.

The engine owns input, selection, and output-contract validation only. Format-specific layout and presentation remain inside renderer strategies.

## Default SVG renderer

The `core.rendering.svg` plugin provides `SvgScoreRenderer` as `rendering.svg`. It produces a deterministic standalone SVG string using no DOM, browser globals, filesystem APIs, or UI framework. The SVG records hierarchy, event order, exact written pitches, durations, offsets, clefs, key signatures, time signatures, and immutable node metadata. Dynamic text and attributes are XML escaped.

```js
const svg = renderingEngine.render(scoreGraph, {
    pluginId: "core.rendering.svg",
    strategyId: "svg",
    width: 1200
});
```

## Kernel integration and descriptors

`RenderingModule` registers `rendering.engine`, `rendering.strategyRegistry`, the `core.rendering.svg` plugin, and the `rendering.svg` renderer descriptor transactionally. Failed configuration rolls back only records created by that attempt. Disposal removes only registrations still owned by the module.

Public descriptors are exported as `renderingServiceDescriptors`, `renderingRendererDescriptors`, `defaultRenderingPluginDescriptor`, and `renderingPackageDescriptor`. Their capabilities describe score-graph input, plugin-scoped deterministic selection, standalone SVG output, and XML escaping.

## Boundary

Rendering Core does not implement MusicXML or other export pipelines, playback, application state, browser UI, or v7 behavior. Later Export and UI layers may consume its output, but those concerns are intentionally outside this package.

## Validation

Milestone 6 is validated by the repository's full `npm test` suite: **70 tests passing**. The acceptance suite includes exact SVG output, deterministic selection and rendering, complete score hierarchy coverage, notation-value preservation, XML escaping, immutability, malformed inputs, and transactional Kernel registration boundaries.
