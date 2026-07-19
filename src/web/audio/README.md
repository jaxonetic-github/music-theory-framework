# Web Audio Playback Adapter

The v7.4 Web Audio adapter is a browser-scoped execution boundary outside `src/core`. It consumes an immutable Core `PlaybackPlan` directly. It never derives musical timing from `ScoreGraph`, SVG, MusicXML, React, or DOM state, and it does not change Playback Planning semantics.

## Canonical timing

Playback ticks remain canonical. For plan tempo `bpm` and ticks-per-quarter resolution `r`:

```text
quarter-note seconds = 60 / bpm
event start seconds  = startTick / r × quarter-note seconds
duration seconds     = durationTicks / r × quarter-note seconds
```

`WebAudioPlaybackAdapter.play()` captures `AudioContext.currentTime` once per scheduling transaction and adds every relative event time to that value plus the validated start delay. Events are processed in their existing sequence. Equal-time chord members, overlapping voices, and overlapping parts therefore retain exactly equal or overlapping schedules. Oscillator scheduling uses Web Audio start/stop times, never `setTimeout`, wall clocks, randomness, or transport timers.

## Default oscillator synthesis

Each `PlaybackEvent` creates one oscillator and one gain node. Frequency derives only from MIDI:

```text
frequency = 440 × 2^((midi - 69) / 12)
peak gain = velocity / 127 × master gain
```

Defaults are sine waveform, `0.2` master gain, `0.005` second attack, `0.02` second release, and zero start delay. The gain begins at zero, ramps to peak gain, sustains through the canonical note duration, and ramps to zero over release. For a note shorter than the configured attack, the attack phase deterministically uses the note duration so envelope automation remains chronological; invalid request values are still rejected rather than clamped.

Session voice metadata preserves written pitch spelling, source event identity, hierarchy identity, sequence, MIDI, frequency, and scheduled times. Audio frequency uses MIDI while metadata retains enharmonic spelling.

## Context ownership and cleanup

Passing `context` borrows it. A borrowed context is never closed and unrelated external nodes are untouched. Passing `contextFactory`, or allowing explicit playback to resolve the browser `AudioContext` constructor, creates an adapter-owned context lazily. An owned context closes only during explicit adapter disposal. A suspended context resumes only inside an explicit `play()` call.

`WebAudioPlaybackModule` owns adapters that it creates through its default or supplied `adapterFactory`. Module disposal explicitly disposes that adapter, and a later configure creates a fresh playable adapter. An adapter injected through the `adapter` option is borrowed by default, so module disposal removes registrations without disposing it; the caller retains explicit adapter-disposal responsibility. An injected adapter may be marked owned only when an `adapterFactory` is also supplied for reusable configuration.

Every session owns only its oscillators and gains. Ownership begins immediately after each individual allocation: an oscillator is tracked before gain creation, and the gain is attached to that record immediately after its own allocation. Stop/dispose is idempotent, cancels that session’s sources, and does not affect concurrent sessions. Natural oscillator completion disconnects nodes and completes the session. Gain creation, automation, connection, start, stop, and later scheduling failures cancel and disconnect every node already created by the failed transaction. Empty plans complete without creating audio nodes.

`AudioPlaybackSession.subscribe(listener)` provides ordered state notifications for browser orchestration without timers or polling. Unsubscribe is idempotent, duplicate state assignments do not emit, and listener exceptions are isolated so they cannot corrupt session state or audio cleanup.

Browsers commonly require `play()` to be called from a user gesture before a suspended context may resume. Importing modules, bootstrapping the application, and rendering React never create, resume, or schedule an AudioContext.

## Registration and exclusions

`WebAudioPlaybackModule` registers `web.audio.playback` as a service and `web.audio.oscillator` as a plugin. It does not register in `kernel.registries.playbacks` or renderer discovery; that playback registry remains reserved for `ScoreGraph`-to-`PlaybackPlan` planners.

This milestone intentionally excludes React playback controls, transport UI, Web MIDI and MIDI devices, recording, samples, effects, workers, looping, seeking, tempo changes during a session, notation-following, cursor animation, filesystem access, downloads, networking, persistence, and server APIs.

## Validation

The adapter has 17 focused fake-audio tests. The complete repository suite contains **200 passing tests**.
