# Music Theory Framework

An immutable, plugin-scoped music theory framework with generation, first-class semantic exercises, notation, row-oriented exercise presentation, rendering, export, deterministic playback planning, browser-scoped Web Audio execution and transport, headless application workflows, accessible React playback controls, and a responsive React Exercise Practice UI.

## Architecture

- v6 Foundation, registries, Kernel, Theory, Notation, and Rendering
- v7.0 immutable MusicXML Export Core
- v7.1 headless Application Workflow Core
- v7.2 React Web Application Adapter
- v7.3 Playback Planning Core for exact, audio-free ScoreGraph scheduling
- v7.4 browser-scoped Web Audio Playback Adapter for explicit PlaybackPlan execution
- v7.5 browser-scoped, UI-neutral Playback Transport Controller
- v7.6 accessible React Playback Controls over generated ApplicationResult scores
- v8.0 Exercise Model and Generation Core for deterministic semantic scales, thirds, arpeggios, and chords
- v8.1 Exercise Notation and Layout for immutable row-oriented ScoreGraph documents
- v8.2 Exercise Presentation and Application Workflow for browser-free generation, notation, and deterministic row rendering
- v8.3 accessible React Exercise Practice UI over authoritative immutable presentation results
- v8.4 Advanced Exercise Generation Core for deterministic approach notes, enclosures, and semantic chord progressions
- v8.5 React Advanced Exercise Practice UI with catalog-driven targets and chord progressions
- v8.6 Exercise Set and Worksheet Workflow for immutable heterogeneous practice documents
- v8.7 Embeddable Web Package and Next.js App Router integration

Playback Planning produces immutable tick plans only. React passes generated scores to the planning engine, loads returned plans into Transport, and issues explicit user commands. Web Audio alone converts ticks and schedules sound. Core remains browser-free. Pause, seek, looping, score-following, and Web MIDI remain excluded.

Exercise Core composes existing Theory catalogs and generators into immutable semantic material. It has first-class descriptor discovery at `kernel.registries.exercises` and a separate plugin-scoped strategy registry. Exercise does not produce notation, rendering, MusicXML, playback, audio, or React output.

The v8.4 advanced strategy adds sequential approach-note and enclosure phrases plus simultaneous root-position chord progressions. Written spelling—including Cb, B#, and supported double accidentals—remains authoritative while MIDI retains sounding pitch. Progressions use ordered harmonic functions and scale degrees, then pass through the existing ExerciseNotation and ExerciseApplication pipelines. The v8.5 React adapter exposes those families without reproducing their musical algorithms.

Exercise Notation consumes those semantic models without changing them. It converts each row through the shared Notation strategy infrastructure into one self-contained ScoreGraph and adds measure/system grouping as renderer-neutral semantic layout guidance.

Exercise Application orchestrates the active Exercise, ExerciseNotation, and Rendering services into immutable row presentations. The v8.5 React adapter submits one validated foundational or advanced request to that service, preserves completed-result ownership, validates trusted SVG metadata, and presents independent rows and semantic systems responsively. Exercise audio, MIDI, transport, downloads, persistence, networking, and grading remain deferred.

Exercise Set v8.6 sequentially composes ordered `ExerciseApplicationRequest` values into an atomic immutable worksheet. Each set item retains its exact authoritative application result, independent ScoreGraphs, renderer identity, spelling, and advanced semantic metadata. The React worksheet editor keeps mutable draft intent separate from completed output, uses stable identities for reordering and duplication, validates every SVG row through the existing trust boundary, and adds responsive and print-oriented presentation without PDF or download generation.

The v8.7 package exposes a self-providing `MusicTheoryApp`, a `"use client"` `MusicTheoryPage` for Next.js App Router, and the supported `music-theory-framework/web/styles.css` entry. Reusable imports never execute the standalone `main.jsx` mount. React and ReactDOM are host-owned peers, runtime ownership is explicit, embedded instances receive unique IDs and isolated default runtimes, and CSS is scoped beneath `.music-theory-app`. See [`src/web/next/README.md`](src/web/next/README.md) for local installation and App Router configuration.

## Development

```sh
npm install
npm run dev
```

Vite serves the React adapter, which additionally bootstraps Exercise, ExerciseNotation, and ExerciseApplication in dependency order while preserving the existing Application, Playback Planning, owned Web Audio, and borrowed-adapter Transport services without eagerly creating an AudioContext.

## Validation

```sh
npm test
npm run build
git diff --check
```

The production build is emitted to `dist/`. See [`src/web/README.md`](src/web/README.md) for the adapter architecture, trusted SVG boundary, and MusicXML download behavior.

The v8.7 repository suite contains **334 passing tests**: 288 plain-Node tests and 46 React DOM tests. `npm audit` reports **0 vulnerabilities**. The production Vite build transforms **314 modules**. The Next.js 15.5.20 fixture compiles and statically prerenders successfully.
