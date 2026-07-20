# Exercise Notation and Layout

Exercise Notation is the v8.1 headless adapter from semantic `ExerciseModel` material to an immutable `ExerciseNotationDocument`. Each source section retains its identity and order; each source row becomes one `ExerciseNotationRow` containing one independently valid `ScoreGraph`. Rendering, Export, and future Playback use those row graphs independently. The source model and its Theory values are never modified or regenerated.

## Step conversion and traceability

A non-simultaneous one-note step emits one `NoteNode`. A simultaneous multi-note step emits one `ChordNode` whose member order exactly matches `ExerciseStep.notes`. A non-simultaneous multi-note step, including a scale-in-thirds pair, emits ordered `NoteNode` values. Every event carries model, section, row, step, source, role, scale-degree, chord-member, and emitted-position attributes. IDs derive from those semantic identities and structural positions; clocks, random values, UUIDs, hashes, and counters are not used.

Written flats, sharps, Cb, and B# remain exact `Note` values. Exercise Notation never recalculates scale or chord formulas and never interprets steps as renderer geometry.

## Exact duration and measures

The default event duration is the exact rational quarter note (`1/4`) and the default time signature is 4/4. Each melodic event receives that duration; a blocked chord shares one duration. Measure capacity is `beats / beatUnit` in whole notes and is compared using integer rational arithmetic. An event that does not fit begins the next measure. Events are never rounded, split, tied, dropped, or duplicated, and an event longer than a measure is rejected.

The final measure may be incomplete. `finalMeasureComplete` is true only when its exact accumulated duration equals measure capacity. Measures start at 1, use one deterministic voice, and contain exact `next` precedence between their events.

## Key signatures and clefs

The conservative default key-signature policy is `none`; pitches still retain their written accidentals. `explicit` requires a validated existing `KeySignature`. `exercise-root` derives only major signatures for major scale rows and minor signatures for melodic-minor rows, using the existing key-signature contract. Unsupported roots such as B# or ambiguous exercise families reject instead of guessing. Cb, F#, and Db major are safely supported. Accidentals remain written regardless of policy.

Treble is the default clef. Treble and bass are supported explicitly; automatic or instrument-specific clef changes are excluded.

## Semantic systems

`measuresPerSystem` defaults to 4 and groups contiguous measure identities into immutable `ExerciseNotationSystem` values. The last system may contain fewer measures. Systems are layout guidance only: they contain no pixels, dimensions, staff coordinates, pagination, or renderer geometry, and every measure belongs to exactly one system.

## Strategies and lifecycle

`ExerciseRowNotationStrategy` conforms to the existing `NotationStrategy` contract and supports `ExerciseRow` only. `ExerciseNotationModule` transactionally installs it in the active Kernel `notation.strategyRegistry`, registers its engine service, plugin, and `ExerciseDescriptor`, and places discovery only in `kernel.registries.exercises`. Reconfiguration resolves the currently active notation registry. Existing scale and chord notation strategies and all renderer, exporter, generator, and playback registries remain independent.

This milestone excludes combined row SVG, React Exercise Explorer, combined exercise-book MusicXML, PDF and print pagination, playback execution, approach notes, enclosures, and progressions.

Exercise Notation has 12 focused test clusters. The complete repository suite contains **234 passing tests**: 214 plain-Node tests and 20 React DOM tests.
