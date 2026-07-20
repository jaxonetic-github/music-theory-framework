# Embeddable React Web Application, Playback, and Exercise Practice Adapters

The v8.7 Web package preserves the general workflow, playback UI, Exercise Practice adapter, and heterogeneous Exercise Set worksheet while adding supported Vite and Next.js embedding entry points. React does not generate theory or exercises, traverse `ScoreGraph`, calculate musical timing, serialize SVG or MusicXML, schedule audio nodes, or manage AudioContext directly.

## Embedding

Import `MusicTheoryApp` from `music-theory-framework/web` for an ordinary React host, default or named `MusicTheoryPage` from `music-theory-framework/web/next` for an App Router client boundary, and global package CSS from `music-theory-framework/web/styles.css`. The stylesheet is globally imported by a Next root layout but scopes its rules beneath `.music-theory-app`. `src/web/main.jsx` is only the standalone Vite mount and must never be imported by a host. React and ReactDOM are peer dependencies to prevent duplicate host React instances. Since published entry points contain source JSX, Next hosts configure `transpilePackages: ["music-theory-framework"]`. Complete local `file:`/workspace installation and route examples are in [`next/README.md`](next/README.md).

`MusicTheoryApp` owns its runtime by default and disposes it at unmount. A `runtime` prop is borrowed and never disposed; `runtimeFactory` and `runtimeOptions` customize an owned lifecycle. Strict Mode cleanup, failed bootstrap rollback, stale-operation guards, isolated multiple mounts, and React-generated DOM IDs preserve lifecycle and accessibility guarantees. It renders one `main` landmark, so hosts place it outside another `main`. Caller `className` values are deterministically merged with `music-theory-app`.

## Bootstrap and ownership

`createWebApplication()` installs Theory, Notation, Rendering, Exercise, ExerciseNotation, ExerciseApplication, Export, Application, Playback, Web Audio, and Transport modules in dependency order. The Web Audio module intentionally owns the shared adapter; Transport borrows it. Reverse Kernel disposal stops and disposes Transport before the audio module closes its owned context. React borrows runtime services and never disposes them.

Bootstrap, registration, rendering, and effects do not create or resume an AudioContext. Browser audio begins only when a user activates Play or Replay. Component unmount may stop its active transport session, while runtime disposal retains responsibility for service disposal.

`ApplicationProvider` owns bootstrap lifecycle. `useApplicationRuntime()` exposes the runtime, and `useApplicationWorkflow()` preserves empty, loading, success, stage-error, and stale-request behavior.

## Generated score to audio

After a current workflow succeeds, React passes the exact immutable `ApplicationResult.score` to `playback.engine.plan()`, retains result identity, and loads the immutable plan into Transport. Planning creates no sound. Transport orchestrates sessions; Web Audio alone converts canonical ticks and schedules oscillators. Playback never derives from rendered SVG, MusicXML, DOM, or form state.

Starting another workflow stops current playback immediately. Loading its result causes Transport to clean the previous session. Editing form fields without executing a workflow does not interrupt playback. Planning failures are announced separately and leave the successful result, pitches, SVG, and MusicXML export intact.

## Controls, state, and errors

The successful result contains native Play, Stop, and Replay buttons in a labeled fieldset. Play is disabled while starting, scheduled, or playing. Stop is enabled only during those states. Replay is enabled after stopped, completed, or failed while the current plan remains loaded. Status changes use a polite atomic live region, and planning, autoplay, playback, and cleanup failures use alerts.

`usePlaybackTransport()` uses `useSyncExternalStore` to read immutable snapshots with one subscription per transport identity and no polling. Deterministic command generations prevent stale promise completion from replacing newer UI state. New Play or Replay commands clear stale execution errors. Listener and component cleanup never move focus automatically.

Browser autoplay policy may reject audio even after a visible action; the original safe error remains visible with guidance to initiate audio from Play or Replay.

## Existing output boundaries

Trusted SVG remains sourced only from `ApplicationResult.rendering`. `downloadExport()` still creates and revokes a browser Blob URL from immutable `ExportResult` data, with its filename derived from the completed request. Playback controls are visually and behaviorally separate from MusicXML download.

Exercise Practice consumes only `exercise.application.engine`. Bootstrap adapts the active Theory catalogs and required `exercise.progressionCatalog` into deeply immutable presentation-safe choices without transferring service ownership. Chord records retain every active catalog entry and declare whether their existing triad/seventh structure supports advanced targets; unsupported extended chords remain available to foundational workflows and never prevent startup. The same narrow trust boundary admits presentation markup only from the exact internal `core.rendering.svg` / `svg` identity after rejecting active, styled, or external SVG content. Submitted control revisions keep a result stale when advanced or foundational controls change during generation, while the completed result remains authoritative and later failures preserve its correct stale state. See [`exercise/README.md`](exercise/README.md) for request normalization, target availability, stale-operation handling, semantic-system layout, accessibility, and deferred scope.

Exercise Worksheet consumes `exercise.set.application`, reuses the same catalog records and request normalization, and validates every nested authoritative ExerciseApplication presentation through that trust boundary. Stable draft IDs support section/item add, remove, duplicate, and reorder operations without array-index React keys. Completed results remain visible and stale after material edits; newer operations win and later failures do not destroy prior output. Responsive and print CSS produce a coherent worksheet without adding a PDF or export strategy. See [`exercise-set/README.md`](exercise-set/README.md).

## Exclusions and validation

This milestone excludes pause/resume, seeking, scrubbing, looping, tempo changes during playback, score-following, cursor animation, Web MIDI, recording, samples, effects, mixer UI, server APIs, persistence, and networking. Core imports remain React-, DOM-, browser-, AudioContext-, and MIDI-free.

The v8.7 repository suite contains **334 passing tests**: 288 plain-Node tests and 46 React DOM tests. `npm audit` reports **0 vulnerabilities**. Vite transforms **314 modules**, and the Next.js 15.5.20 fixture compiles and statically prerenders successfully.
