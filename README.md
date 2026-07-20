# Music Theory Framework

An immutable, plugin-scoped music theory framework with generation, first-class semantic exercises, notation, row-oriented exercise presentation, rendering, export, deterministic playback planning, browser-scoped Web Audio execution and transport, headless application workflows, and accessible React playback controls.

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

Playback Planning produces immutable tick plans only. React passes generated scores to the planning engine, loads returned plans into Transport, and issues explicit user commands. Web Audio alone converts ticks and schedules sound. Core remains browser-free. Pause, seek, looping, score-following, and Web MIDI remain excluded.

Exercise Core composes existing Theory catalogs and generators into immutable semantic material. It has first-class descriptor discovery at `kernel.registries.exercises` and a separate plugin-scoped strategy registry. Exercise does not produce notation, rendering, MusicXML, playback, audio, or React output.

Exercise Notation consumes those semantic models without changing them. It converts each row through the shared Notation strategy infrastructure into one self-contained ScoreGraph and adds measure/system grouping as renderer-neutral semantic layout guidance.

Exercise Application orchestrates the active Exercise, ExerciseNotation, and Rendering services into immutable row presentations. It preserves each independent ScoreGraph and semantic system, supports an exact supplied-model bypass, records the renderer actually selected, and fails atomically without inferring semantics from rendered output. React exercise UI remains a future milestone.

## Development

```sh
npm install
npm run dev
```

Vite serves the React adapter, which bootstraps Theory, Notation, Rendering, Export, Application, Playback Planning, owned Web Audio, and borrowed-adapter Transport services without eagerly creating an AudioContext.

## Validation

```sh
npm test
npm run build
git diff --check
```

The production build is emitted to `dist/`. See [`src/web/README.md`](src/web/README.md) for the adapter architecture, trusted SVG boundary, and MusicXML download behavior.

The current repository suite contains **246 passing tests**: 226 plain-Node tests and 20 React DOM tests.
