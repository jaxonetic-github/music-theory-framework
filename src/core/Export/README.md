# Export Core

Export Core begins the v7 boundary for deterministic serialization of immutable Notation `ScoreGraph` values. It consumes the score graph directly, never parses Rendering output, and never mutates notation or theory values.

## Export engine and strategies

`ExportEngine.export(scoreGraph, format, options)` validates the input and target format, then selects an `ExporterStrategy` through `ExporterStrategyRegistry`. Strategies declare an id, plugin id, format, and media type. Plugin scopes isolate identical strategy ids, while registration order provides deterministic implicit selection. Explicit `pluginId` and `strategyId` options select one strategy exactly.

The engine contains no format-specific serialization. Strategies return an immutable `ExportResult` with `format`, `mediaType`, filename `extension`, and serialized `content`. Export Core returns data only; it does not download or write it.

## Default MusicXML strategy

The `core.export.musicxml` plugin provides `MusicXmlExporter` as `export.musicxml`. It emits deterministic standalone MusicXML 4.0 `score-partwise` documents from score, part, measure, voice, note, rest, and chord nodes. Exact written steps, alterations, octaves, clefs, key signatures, time signatures, rational durations, voice numbers, measure numbers, and `next`-edge precedence are preserved.

MusicXML divisions are calculated per measure with integer rational arithmetic. The exporter chooses the least divisions value that represents every event exactly and rejects any conversion that would require rounding. Chord members after the first use MusicXML `<chord/>` semantics.

```js
const result = exportEngine.export(scoreGraph, "musicxml", {
    pluginId: "core.export.musicxml",
    strategyId: "musicxml"
});

result.mediaType; // application/vnd.recordare.musicxml+xml
result.extension; // musicxml
result.content;   // standalone score-partwise XML
```

## Rendering versus Export

Rendering produces presentation output such as SVG. Export serializes domain meaning for interchange formats such as MusicXML. Export reads `ScoreGraph` directly and does not consume or reverse-engineer SVG.

## Kernel integration and descriptors

`ExportModule` transactionally registers `export.engine`, `export.strategyRegistry`, the `core.export.musicxml` plugin, and the `export.musicxml` exporter descriptor. Failed configuration rolls back only registrations created by that attempt. Disposal removes only records still owned by the module.

Public descriptors are exported as `exportServiceDescriptors`, `exportExporterDescriptors`, `defaultExportPluginDescriptor`, and `exportPackageDescriptor`.

## Explicit boundary

Browser downloads, filesystem output, network transport, playback, MIDI, UI frameworks, application state, and unrelated v7 features remain outside this milestone.

## Validation

Milestone 7 is validated by the repository's full `npm test` suite: **96 tests passing**. Coverage includes exact MusicXML output, hierarchy and multiple voices, notes/rests/chords, rational divisions, signatures, enharmonic spelling, XML escaping, deterministic precedence ordering, immutable inputs/results, malformed data, and every transactional Kernel registration boundary.
