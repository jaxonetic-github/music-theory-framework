# Application Workflow Core

Application Workflow Core is the v7.1 headless orchestration boundary. It runs existing Theory, Notation, optional Rendering, and optional Export services through one deterministic API without copying their domain logic.

## Request and result

`ApplicationRequest` is an immutable, type-discriminated workflow specification. Scale requests use `pattern`; chord requests use `quality`. Generation and notation options pass directly to their existing public APIs. Rendering and export are independent optional stages with a format, optional plugin/strategy selection, and strategy options.

`ApplicationResult` preserves the normalized request, original `GenerationResult`, the exact `ScoreGraph` used by every downstream stage, optional `RenderingOutput`, optional immutable `ExportResult`, and deterministic service/strategy metadata. No stage converts domain objects to lossy plain representations.

## Scale and chord workflows

```js
const scale = application.run({
    type: "scale",
    root: "Eb",
    pattern: "major",
    notationOptions: { octave: 4 }
});

const chord = application.run({
    type: "chord",
    root: "F#",
    quality: "minor-7"
});
```

## Optional SVG and MusicXML

```js
const result = application.run({
    type: "scale",
    root: "C",
    pattern: "major",
    rendering: {
        format: "svg",
        pluginId: "core.rendering.svg",
        strategyId: "svg",
        options: { width: 900 }
    },
    export: {
        format: "musicxml",
        pluginId: "core.export.musicxml",
        strategyId: "musicxml"
    }
});
```

Rendering and Export both receive `result.score`. Export never reads or parses rendered SVG.

## Service resolution and plugin passthrough

`MusicTheoryApplication` resolves `theory.scaleGenerator` or `theory.chordGenerator`, `notation.engine`, and requested optional stage engines from Kernel services. Plugin and strategy ids pass through to the established registries; the workflow never bypasses plugin isolation. Missing or failing stages throw `ApplicationWorkflowError` with a `stage` and original `cause`, and no partial `ApplicationResult` is returned.

`ApplicationModule` registers `application.engine`, its service descriptor, and the thin `application.runWorkflow` command handler transactionally.

## Explicit boundary

This package contains no React or other UI framework, browser or DOM integration, downloads, filesystem writes, networking, persistence, playback, Web Audio, MIDI, CLI behavior, or unrelated v7 features.

## Validation

The Milestone 8 implementation passes all 111 repository tests. `git diff --check` also passes.
