# Rendering Core

Rendering Core is the v6.5 boundary that turns an immutable Notation `ScoreGraph` into presentation output. It reads score, part, measure, voice, note, rest, and chord nodes without changing the graph or any contained notation or theory value.

## Engine and strategies

`RenderingEngine.render(scoreGraph, options)` selects a `RendererStrategy` through `RendererStrategyRegistry`. Strategies are registered inside plugin scopes, so independent plugins can use the same strategy id without colliding. Selection is deterministic: an explicit `pluginId` and `strategyId` selects that exact strategy, while implicit selection uses registration order among strategies matching the normalized requested `format`. Omitting `format` preserves registration-order selection across all supported formats.

The engine owns input, deterministic layout-plan resolution, renderer selection, and output-contract validation. Layout v8.8 remains renderer-independent; format-specific presentation stays inside renderer strategies.

## Default SVG renderer

The `core.rendering.svg` plugin provides `SvgScoreRenderer` as `rendering.svg`. It produces a deterministic standalone SVG string using no DOM, browser globals, filesystem APIs, or UI framework. The SVG records hierarchy, event order, exact written pitches, durations, offsets, clefs, key signatures, time signatures, and immutable node metadata. Dynamic text and attributes are XML escaped.

```js
const svg = renderingEngine.render(scoreGraph, {
    pluginId: "core.rendering.svg",
    strategyId: "svg",
    width: 1200
});
```

Legacy requests use the frozen `screen-regular` profile and its default width. Callers may supply an explicit width/profile or an already validated `LayoutPlan`. The SVG renderer consumes plan placements directly and records profile, available width, natural width, overflow, and stable visual-system identities in output metadata; it never parses or repositions completed markup.

### Engraving glyph strategy

The renderer owns a deterministic set of SVG paths and geometric primitives for clefs, accidentals, noteheads, stems, flags, augmentation dots, rests, ledger lines, staff lines, and barlines. Written letter name and octave determine vertical placement relative to the active clef; MIDI is not used for staff position. Key-signature state and per-measure accidental state control visible accidentals. Chord heads share one rhythmic x position, seconds receive a fixed offset, and chords use one stem. Isolated short values receive individual flags; beaming is intentionally deferred.

No third-party engraving dependency or font asset is used. The vector definitions are original project code and are distributed under this repository's existing license. This removes platform-font fallback, network loading, DOM measurement, SSR, additional bundle dependency, and third-party license concerns. SVG metadata and accessible labels preserve exact pitch spelling and rational duration while normal presentation paints no diagnostic pitch names.

The renderer maps alterations -2 through +2 explicitly to double-flat, flat, natural, sharp, and double-sharp vector glyphs and rejects unsupported values. Within each staff and measure, accidental state is shared across voices and keyed by written diatonic step plus octave. Rendering traverses the LayoutPlan's exact-rational chronological `eventPlacements` stream and shared onset anchors, so raw offsets, voice grouping, and differing glyph widths cannot override rhythmic order or horizontal alignment. All events at one onset—including every chord member—consult the same pre-onset state; matching updates are committed together afterward, while contradictory simultaneous alterations leave a conflict sentinel that forces the next occurrence to show an explicit accidental. Key signatures supply per-step defaults across octaves, while measure overrides reset at each barline. Rendering consumes Layout's immutable key-transition lists: only removed or altered prior steps receive cancellation naturals, followed by the complete new signature. Changed key and meter headers are emitted at their allocated measure boundary and repeated with the active clef at a new visual system.

Notes and rests share one exact rational engraving classifier owned by Core Layout. Supported base values are whole, half, quarter, eighth, sixteenth, thirty-second, and sixty-fourth, each with zero through three augmentation dots. Thus `3/8` is a dotted quarter, `3/16` is a dotted eighth, and normalized equivalent fractions produce identical output. Classification uses integer equality rather than floating-point rounding; other rationals, including tuplet-like `1/3`, fail with a clear rendering validation error. Rest hooks and augmentation dots are renderer-owned SVG primitives, while frozen Layout metrics reserve their horizontal bounds before SVG emission.

## Kernel integration and descriptors

`RenderingModule` registers `rendering.engine`, `rendering.strategyRegistry`, the `core.rendering.svg` plugin, and the `rendering.svg` renderer descriptor transactionally. Failed configuration rolls back only records created by that attempt. Disposal removes only registrations still owned by the module.

Public descriptors are exported as `renderingServiceDescriptors`, `renderingRendererDescriptors`, `defaultRenderingPluginDescriptor`, and `renderingPackageDescriptor`. Their capabilities describe score-graph input, plugin-scoped deterministic selection, standalone SVG output, and XML escaping.

## Boundary

Rendering Core does not implement MusicXML or other export pipelines, playback, application state, browser UI, or v7 behavior. Later Export and UI layers may consume its output, but those concerns are intentionally outside this package.

## Validation

Rendering Core is validated by the repository's full v8.8 `npm test` suite. The acceptance suite includes conventional five-line staff fixtures, every accepted clef, written enharmonic placement, ledger lines, duration/rest glyphs, chord/accidental collision handling, key and meter headers, explicit profiles and widths, layout-plan consumption, deterministic topological event ordering, complete score hierarchy coverage, notation-value preservation, accessibility, XML escaping, immutability, malformed inputs, and transactional Kernel registration boundaries.
