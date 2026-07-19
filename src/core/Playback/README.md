# Playback Planning Core

Playback Planning Core is the v7.3 framework-neutral scheduling boundary. It converts an immutable Notation `ScoreGraph` directly into an immutable `PlaybackPlan`; it never reads SVG or MusicXML and never produces sound.

## Engine and plugin-scoped strategies

`PlaybackEngine.plan(scoreGraph, options)` validates a `PlaybackRequest`, selects a `PlaybackStrategy` through `PlaybackStrategyRegistry`, and validates the returned plan contract. Strategies are isolated by plugin id. Implicit selection follows registration order, while an explicit `pluginId` and `strategyId` selects one exact strategy without bypassing plugin scope.

`PlaybackModule` registers `playback.engine`, `playback.strategyRegistry`, the default `core.playback.score` plugin, and its score planner descriptor transactionally. Failed configurations roll back only registrations owned by that attempt; disposal is reusable, idempotent, and preserves replacements.

## Exact rational timing

Resolution is ticks per quarter note. With no explicit resolution, the default planner derives the smallest positive safe integer that represents every rational notation duration exactly. For a whole-note duration `n/d`, its tick length is:

```text
ticks = n × 4 × resolution ÷ d
```

The division must be exact. An explicit resolution that cannot represent a duration is rejected, and all resolution, duration, accumulation, and plan-total calculations use exact `BigInt` arithmetic before conversion to safe JavaScript integers. Values that would overflow the safe integer range are rejected rather than rounded.

## Offset ordering and playback time

`ScoreGraph` event `offset` values are ordinal ordering metadata, not whole-note positions. Every `next` edge is a precedence constraint. Among currently available events, the planner uses numeric offset and then node id, matching Rendering and Export. Actual start ticks come only from the resulting event sequence and rational durations.

## Score scheduling

- A note emits one scheduled `PlaybackEvent`, preserving its exact written `Note`, spelling, MIDI number, source event id, and hierarchy identity.
- A chord emits one simultaneous scheduled event per member. Members share start and duration ticks and retain chord id/index metadata.
- A rest emits no sounding event but advances its voice by its exact duration.
- Voices begin independently at the measure start and may overlap. A measure advances by its longest voice.
- Measures are ordered by number and id. Each part advances through its own measures.
- Parts begin independently at tick zero and may overlap.
- Final playback events receive a deterministic global sequence.

Tempo defaults to 120 quarter notes per minute. Velocity defaults to 96 and is validated from 1 through 127. Tick timing remains canonical; `PlaybackPlan.ticksToSeconds()` is a pure conversion and does not use a clock.

## Explicit boundary

This package contains no `AudioContext`, Web Audio, Web MIDI, MIDI device access, DOM, React, transport timer, playback control, download, filesystem, network, persistence, or server behavior. The v7.2 Web adapter intentionally gains no playback controls in this milestone.

## Validation

Playback Planning Core is covered by 22 focused acceptance tests. The complete repository suite contains **155 passing tests**. Production Web build and `git diff --check` are also validated.
