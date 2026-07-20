# React Exercise Practice UI

The v8.5 browser adapter exposes `exercise.application.engine` through `ExercisePracticePanel`. React owns only form, operation, focus, and display state. The deterministic request builder creates one immutable `ExerciseApplicationRequest`; React never calls Theory, Exercise generation, ExerciseNotation, or Rendering algorithms itself.

## Advanced choices and requests

The family selector has a documented stable order: Scale, Scale in thirds, Triad arpeggio, Seventh arpeggio, Blocked chord, Broken chord, Approach note, Enclosure, and Chord progression. Stable IDs—not display labels—drive conditional controls.

Approach-note and enclosure controls use the public immutable Core pattern and target constants. Their chord qualities come from the active Theory chord catalog. Each UI-safe chord record has an immutable `targetCompatible` flag; compatible triads and seventh chords also carry immutable `memberRoles`. Only those compatible qualities appear in advanced target controls, where the roles determine whether root, third or suspended-member equivalent, fifth, seventh, and all-member targets are available. Extended and custom chords remain in catalog order for foundational exercises but are not assigned invented ninth/eleventh/thirteenth target semantics. Direct incompatible advanced requests fail locally with a clear validation error. Selecting a triad normalizes an unavailable seventh target without duplicating interval arithmetic in React. Approach notes resolve one chromatic or diatonic neighbor to a chord tone. Enclosures place two selected chromatic/diatonic neighbors around a chord tone and resolve to it.

Progression choices are immutable presentation records adapted from the active `exercise.progressionCatalog`, in catalog order, with ID, display name, mode, and an ordered harmonic-event summary. Components never receive or own the mutable service. The initial progression is the first active entry; an absent service or empty catalog produces a clear configuration failure.

Family transitions delete incompatible hidden fields. Advanced requests include only their quality/target/pattern or progression, exact root or all-key selection, starting octave, Core-required fixed direction/octave values, shared notation options, and the approved SVG rendering format. Exact Db, F#, Cb, and B# spelling is preserved, inputs are not mutated, and equivalent normalized state yields equivalent immutable requests.

## Completed-result ownership

A successfully validated immutable `ExerciseApplicationResult` is the sole source for displayed section titles, row titles, roots, families, patterns or qualities, ScoreGraph identity, semantic systems, renderer identity, and SVG. Editing controls keeps that result unchanged and marks it as awaiting regeneration. A failure preserves the last successful result, and a later success replaces it atomically.

Each operation receives a monotonically increasing identity, and each material control edit advances a separate control revision. Generation captures the submitted revision; a successful result is fresh only when that revision still matches the live controls. Edits made while an operation is pending therefore leave its eventual authoritative result visibly stale. Failures preserve both the previous result and its correct revision relationship. Synchronous throws and Promise-returning engines share the same boundary. Stale success and failure are ignored, duplicate form submission is guarded, and cleanup invalidates pending operations so unmounted components cannot update state. Components borrow the engine and never dispose the shared runtime.

## Trusted SVG and semantic layout

`validateExercisePresentation()` accepts only an actual `ExerciseApplicationResult` whose document and every row identify the approved `core.rendering.svg` / `svg` renderer, use normalized `svg` format and `image/svg+xml`, and contain a nonempty standalone SVG. It rejects active or HTML-like elements, event handlers, style content, CSS URLs and imports, external/data/JavaScript URLs, unsafe `href` values, processing instructions, and doctypes. Same-document fragment references are the only accepted `href` form. Only content passing that narrow boundary reaches `dangerouslySetInnerHTML`; the adapter has no general HTML injection API or permissive plugin path.

Rows stay in exact document order and retain independent ScoreGraphs. Advanced summaries read family, root, quality, target, pattern, progression identity, mode, and harmonic-event count only from the completed result and its source row. `ExercisePresentationRow.systems` and measure membership are shown as semantic grouping information without parsing SVG positions or merging graphs. Responsive CSS wraps controls and advanced fieldsets, preserves focus indicators, and gives wide notation a horizontal scrolling container on narrow screens.

## Accessibility and errors

The panel has semantic headings, labeled native controls, family/target/pattern/progression fieldsets, concise help text, keyboard-operable actions, `aria-busy`, a restrained live status, row-specific notation labels, alerts for separate input/workflow/presentation failures, and deterministic result-or-error focus. Rendering many all-key rows does not generate a separate live announcement for each row.

## Deferred work

Advanced exercise audio, MIDI, playback transport, Play/Stop/Pause/Replay/Loop/tempo controls, score following, downloads, PDF/MusicXML export, persistence, presets, history, grading, answer tracking, networking, accounts, and server storage are explicitly deferred. Existing non-exercise playback and MusicXML download behavior remains separate and unchanged.
