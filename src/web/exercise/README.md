# React Exercise Practice UI

The v8.3 browser adapter exposes `exercise.application.engine` through `ExercisePracticePanel`. React owns only form, operation, focus, and display state. The deterministic request builder creates one immutable `ExerciseApplicationRequest`; React never calls Theory, Exercise generation, ExerciseNotation, or Rendering algorithms itself.

## Completed-result ownership

A successfully validated immutable `ExerciseApplicationResult` is the sole source for displayed section titles, row titles, roots, families, patterns or qualities, ScoreGraph identity, semantic systems, renderer identity, and SVG. Editing controls keeps that result unchanged and marks it as awaiting regeneration. A failure preserves the last successful result, and a later success replaces it atomically.

Each operation receives a monotonically increasing identity, and each material control edit advances a separate control revision. Generation captures the submitted revision; a successful result is fresh only when that revision still matches the live controls. Edits made while an operation is pending therefore leave its eventual authoritative result visibly stale. Failures preserve both the previous result and its correct revision relationship. Synchronous throws and Promise-returning engines share the same boundary. Stale success and failure are ignored, duplicate form submission is guarded, and cleanup invalidates pending operations so unmounted components cannot update state. Components borrow the engine and never dispose the shared runtime.

## Trusted SVG and semantic layout

`validateExercisePresentation()` accepts only an actual `ExerciseApplicationResult` whose document and every row identify the approved `core.rendering.svg` / `svg` renderer, use normalized `svg` format and `image/svg+xml`, and contain a nonempty standalone SVG. It rejects active or HTML-like elements, event handlers, style content, CSS URLs and imports, external/data/JavaScript URLs, unsafe `href` values, processing instructions, and doctypes. Same-document fragment references are the only accepted `href` form. Only content passing that narrow boundary reaches `dangerouslySetInnerHTML`; the adapter has no general HTML injection API or permissive plugin path.

Rows stay in exact document order and retain independent ScoreGraphs. `ExercisePresentationRow.systems` and measure membership are shown as semantic grouping information without parsing SVG positions or merging graphs. Responsive CSS wraps controls, preserves focus indicators, and gives wide notation a horizontal scrolling container on narrow screens.

## Accessibility and errors

The panel has semantic headings, labeled native controls, a family fieldset, keyboard-operable actions, `aria-busy`, a restrained live status, row-specific notation labels, alerts for separate input/workflow/presentation failures, and deterministic result-or-error focus. Rendering many all-key rows does not generate a separate live announcement for each row.

## Deferred work

Exercise audio, MIDI, playback transport, Play/Stop/Pause/Replay/Loop controls, score following, downloads, PDF/MusicXML export, persistence, presets, history, grading, answer tracking, networking, accounts, and server storage are explicitly deferred. Existing non-exercise playback and MusicXML download behavior remains separate and unchanged.
