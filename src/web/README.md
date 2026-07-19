# React Web Application and Playback Adapter

The v7.6 Web package connects the headless Application workflow to Playback Planning, browser-scoped Transport, and Web Audio through accessible React controls. React does not generate theory, traverse `ScoreGraph`, calculate musical timing, serialize SVG or MusicXML, schedule audio nodes, or manage AudioContext directly.

## Bootstrap and ownership

`createWebApplication()` installs Theory, Notation, Rendering, Export, Application, Playback, Web Audio, and Transport modules in dependency order. The Web Audio module intentionally owns the shared adapter; Transport borrows it. Reverse Kernel disposal stops and disposes Transport before the audio module closes its owned context. React borrows the runtime transport and never disposes shared services.

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

## Exclusions and validation

This milestone excludes pause/resume, seeking, scrubbing, looping, tempo changes during playback, score-following, cursor animation, Web MIDI, recording, samples, effects, mixer UI, server APIs, persistence, and networking. Core imports remain React-, DOM-, browser-, AudioContext-, and MIDI-free.

The complete repository suite contains **200 passing tests**: 181 plain-Node tests and 19 React DOM tests.
