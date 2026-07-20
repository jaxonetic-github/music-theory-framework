# Exercise Model and Generation Core

Exercise is the v8.0 framework-neutral semantic exercise boundary. It composes existing Theory scale and chord generators, catalogs, patterns, pitch classes, and notes. It produces no `ScoreGraph`, notation, SVG, MusicXML, playback plan, audio, device access, DOM, or React value.

## Semantic hierarchy

An immutable `ExerciseModel` retains the exact normalized `ExerciseRequest`, stable semantic identity, selected plugin/strategy metadata, and ordered sections. Each `ExerciseSection` groups ordered, self-contained `ExerciseRow` values without page or publication layout. A row retains its written root, pattern or quality, direction, octave range, family, semantic metadata, steps, and deterministic flattened written pitches.

`ExerciseStep` is one semantic position. A melodic or broken-chord step contains one `Note`. A scale-in-thirds step contains a sequential two-note semantic pair with `simultaneous: false`. A blocked chord contains multiple notes in one step with `simultaneous: true`. Steps retain stable sequence/source identities, scale degree or chord-member roles, written spelling, and existing `Note` MIDI values. They contain no staff coordinates, notation nodes, timers, or audio objects.

## Requests, roots, and identity

Stable family identifiers are `scale`, `scale-thirds`, `arpeggio-triad`, `arpeggio-seventh`, `chord-blocked`, and `chord-broken`. Directions are `ascending`, `descending`, and `ascending-descending`. Requests accept one or two octaves, a starting octave, explicit plugin/strategy selection, and either one root, an explicitly ordered root array, or `allKeys`.

The canonical all-12 order is **C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B**. It covers every chromatic pitch class once. Explicit arrays retain caller order and spelling and reject enharmonic duplicates. Single Cb and B# requests remain Cb and B#.

IDs contain only normalized request semantics and structural positions: family, ordered roots, pattern/quality, direction, octave count, starting octave, then section/row/step position. No clock, random value, UUID, counter, object hash, or registry insertion sequence participates. Equivalent requests produce deeply equivalent models. Implicit strategy selection sorts by plugin ID and strategy ID.

## Family conventions

Scale rows use Theory's catalog pattern, generated pitch classes, and interval positions. Seven-degree material receives semantic diatonic letter spelling without modifying its source Theory model. One octave includes tonic through the next tonic; two octaves perform actual register expansion. Ascending-descending shares the apex exactly once.

Scale thirds are ordered diatonic pairs starting on every degree in every requested octave. Terminal degrees are not dropped: their partners wrap into the next register, and `endpointWrap` records that endpoint. Descending reverses both pair order and note order. Ascending-descending shares the highest pair position once.

Triad arpeggios require members 1–3–5; seventh arpeggios require 1–3–5–7. Each octave closes on the next root, descending reverses the sequence, and ascending-descending shares its apex. Suspended chords are rejected as triad arpeggios but remain valid blocked/broken material. Inversions and voicing transformations are future extensions.

Blocked rows contain one simultaneous chord step per requested register. Broken rows contain ordered single-note member steps and a closing octave root. Both retain member identities and exact spelling; neither creates a Notation `ChordNode`.

## Octaves and range

Register expansion uses the Theory pattern interval and preserves semantic spelling by finding the written `Note` octave that exactly matches the intended MIDI value. This handles B–C boundaries and altered equivalents: Cb4 is MIDI 59, B#4 is MIDI 72, and their next registers remain Cb5 and B#5. Any target outside MIDI 0–127, or spelling/register combination that cannot represent the exact target, is rejected. Values are never clamped, wrapped, omitted, or silently respelled. No instrument-specific low-B extension exists.

## Engine, strategies, and discovery

`ExerciseEngine` normalizes requests, selects an `ExerciseStrategy` from the plugin-scoped `ExerciseStrategyRegistry`, and validates the immutable model, exact request identity, and plugin/strategy metadata. The default `core.exercise.foundational` strategy covers all initial families by composing Theory generators.

When `ExerciseModule` is installed in a Kernel, it constructs that foundational strategy from the currently registered `theory.scaleGenerator` and `theory.chordGenerator` services. Missing Theory services fail before any Exercise registration occurs. A dispose/configure cycle resolves the current services again, so stale or replaced Theory instances are never retained. Callers may instead inject a complete foundational strategy or explicit generators; those objects remain caller-owned. Direct standalone `FoundationalExerciseStrategy` construction continues to provide its own default Theory generators.

The global typed `ExerciseRegistry` is descriptor/discovery infrastructure at `kernel.registries.exercises`; it is distinct from internal strategy selection. `ExerciseModule` transactionally registers two services, one plugin, and `exercise.foundational` only in the exercise registry. Generator, renderer, exporter, playback, and other discovery categories remain unchanged.

## Exclusions and validation

This milestone excludes notation conversion and layout, rendering, MusicXML, React display, playback planning/execution, Web Audio, Web MIDI, approach notes, enclosures, progressions, voice leading, pattern sequencing, persistence, downloads, networking, and server APIs.

Exercise Core has 21 focused test clusters. The complete repository suite contains **234 passing tests**: 214 plain-Node tests and 20 React DOM tests.
