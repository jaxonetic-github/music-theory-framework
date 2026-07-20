# Exercise Presentation and Application Workflow

Milestone 16 (`v8.2`) adds a framework-neutral, browser-free orchestration package for exercise presentation:

```text
ExerciseRequest -> ExerciseEngine -> ExerciseModel
ExerciseModel -> ExerciseNotationEngine -> ExerciseNotationDocument
each row ScoreGraph -> RenderingEngine -> ExercisePresentationDocument
```

`ExerciseApplicationEngine` coordinates those active services; it does not reproduce generation, notation, layout, or rendering algorithms. A request may instead provide an immutable `ExerciseModel`. That path preserves the exact model instance, bypasses `ExerciseEngine.generate()`, and rejects simultaneous generation input.

## Row identity and traceability

Every presentation row retains its source `ExerciseRow`, source `ExerciseNotationRow`, complete independent `ScoreGraph`, semantic systems, and ordered measure IDs. Stable IDs and metadata carry model, section, exercise-row, notation-row, renderer-plugin, renderer-strategy, format, and row-sequence identity. Existing note spelling, chord-member order, durations, event metadata, and cross-measure `next` precedence remain in the source graph unchanged.

Normalized renderer options participate in request and presentation identity. Width, height, title, and metadata use recursive canonical serialization: object keys are sorted, array order is preserved, and unsupported or cyclic metadata is rejected. Equivalent metadata objects therefore share identity regardless of insertion order, while material rendering-option changes cannot collide.

Semantic systems are renderer-neutral measure groupings from ExerciseNotation. They are guidance for a future interface, not publication geometry. Renderers consume only each row's `ScoreGraph`; the workflow never parses SVG, MusicXML, playback data, or other output to recover musical meaning or layout.

## Rendering and failure behavior

Rendering uses the active `RenderingEngine` and its existing plugin-scoped registry. Format values are normalized, implicit selection remains deterministic, explicit plugin/strategy selection is forwarded, and each row records the renderer and format actually selected. Trusted renderer output is retained verbatim.

The workflow is atomic. Generation, notation, and per-row rendering failures throw `ExerciseApplicationWorkflowError` with the original cause and stage, plus row identity where available. No partially built presentation document or result is returned.

## Explicit exclusions

This package contains no React UI, DOM manipulation, browser downloads, Web Audio, transport, MIDI, persistence, grading, answer checking, random generation, networking, server API, user-account, or publication-quality page-geometry behavior.
