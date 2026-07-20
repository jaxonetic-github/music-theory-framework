# Playback Transport Controller

Playback Transport is the v7.5 browser-scoped, UI-neutral orchestration boundary. It consumes an immutable Core `PlaybackPlan` directly and coordinates execution through a Web Audio playback adapter. Core `PlaybackEngine` remains responsible for `ScoreGraph`-to-plan conversion, and `WebAudioPlaybackAdapter` remains responsible for tick conversion, oscillator scheduling, synthesis, and audio-node cleanup. Transport calculates no musical timing and inspects no score, SVG, MusicXML, DOM, or React state.

## State machine

Controllers begin `idle`. `load(plan)` retains the exact immutable plan reference and produces `ready`. `play()` produces `starting` while adapter execution is pending, then reflects the returned session as `scheduled`, `playing`, or `completed`. Session notifications can subsequently produce `playing`, `stopped`, `completed`, or `failed`. Explicit `stop()` produces `stopped` while preserving the loaded plan. `dispose()` is terminal and produces `disposed`.

`load()` is permitted after `failed`, `stopped`, and `completed`; it clears stale session/error metadata and returns to `ready`. Loading the same plan while already ready and session-free is idempotent. Loading any plan while a session is owned stops and disposes that session first. A disposed controller rejects load, play, replay, stop, and subscription; repeated disposal is idempotent.

## Play, replay, stop, and ownership

`play(options)` validates audio options before changing the active session and forwards them unchanged in normalized form to the adapter. Only one session is owned at a time. A replacement play or `replay()` detaches, stops, and disposes the previous session, then executes the loaded plan from its beginning. `stop()` affects only the controller-owned session, is idempotent once stopped, and never disposes the adapter.

An injected adapter is borrowed and is never disposed by the controller. An adapter created by the default or supplied `adapterFactory` is controller-owned and disposed exactly once during controller disposal. Multiple controllers may safely share one borrowed adapter because each cleans only its own returned sessions.

## Stale asynchronous operations

Every state-changing operation uses a monotonically increasing integer generation. Load, stop, replacement play/replay, and disposal invalidate earlier pending plays. A session returned by a stale play is immediately stopped and disposed and cannot overwrite the current snapshot. A stale rejection is returned to its original caller but cannot replace newer state. Session notifications are accepted only from the currently attached session, so completion from a detached session cannot overwrite its replacement. No random tokens, polling, or timers are used.

## Snapshots and listener policy

`snapshot` is immutable and includes state, exact plan identity and presence, plan metadata identity, current session id, deterministic operation sequence, and normalized public error metadata. `subscribe(listener)` delivers snapshots in registration order and returns an idempotent unsubscribe function. Actual snapshot changes emit once; idempotent operations do not emit duplicates.

`AudioPlaybackSession` now provides the same ordered, idempotently removable state subscription boundary. Session and transport listener exceptions are intentionally isolated and swallowed: one observer cannot block later observers, corrupt state, roll back completed audio work, or turn an external audio operation into a failure. Application code that needs listener-error reporting should catch and report inside its own listener.

## Registration and exclusions

`PlaybackTransportModule` registers `web.playback.transport` through existing service and plugin registries. It never registers in planner or renderer discovery. Module-owned controllers are disposed and recreated for reusable configure/dispose/configure; injected controllers are borrowed unless explicitly paired with a factory and owned.

Construction, import, registration, application bootstrap, and React rendering create no AudioContext. This milestone adds no React controls, visible transport UI, pause/resume, seeking, scrubbing, looping, tempo changes, polling timers, notation following, cursor animation, Web MIDI, filesystem access, downloads, networking, persistence, or server APIs.

## Validation

Playback Transport has 19 focused acceptance tests. The complete repository suite contains **217 passing tests**.
