# Technical Studies Core

Study v9.1 is a browser-free orchestration layer over active Theory, Exercise, ExerciseSet, Curriculum, Layout, Rendering, and Publishing contracts. It never regenerates notation or publishes directly.

`StudyRequest` defaults to two octaves, one selected key, canonical traversal, and four measures per semantic system. Octaves are exact integers from one through four. Key scope and traversal are independent: selected-key always emits one root; all-keys uses the documented canonical, chromatic, or clockwise cycle-of-fifths order. The cycle uses F-sharp at the tritone position: C, G, D, A, E, B, F#, Db, Ab, Eb, Bb, F.

The built-in Full Daily Technical Study combines supported scale, thirds, triad, seventh, broken-chord, approach, enclosure, and progression families. Preflight reports exact key, section, item, system, and conservative page counts and rejects capacity overflow without partial output. Measures per system accepts 1, 2, 4, 8, or 16; ExerciseNotation preserves that semantic grouping while responsive Layout may wrap it into additional visual systems.

Progression requests preserve realization, harmonic-rhythm, annotation, register-span, and traversal metadata. Core implements blocked chords, sequential broken/arpeggiated chord tones, third-and-seventh guide tones, and closest deterministic register-bounded motion. Voice-leading candidates retain written chord spelling, are bounded by the requested one-to-four-octave register, minimize per-voice semitone motion, and break ties toward the lower pitch. Root-position or explicit inversion rotation occurs before realization. Harmonic-rhythm and annotation policies remain exact semantic trace values; richer multi-measure rhythm realization and painted analysis annotations remain follow-up engraving work.

Built-in Curriculum entries provide Daily Scale, Interval, Arpeggio, Harmonic Progression, and Full Daily Technical Studies. They reuse the existing plugin-scoped template catalog; Study does not duplicate Theory catalogs. Every expansion uses bounded deterministic ExerciseSet identities and retains the complete study, traversal, key index/spelling, register, realization, rhythm, annotation, and layout request in immutable metadata.

Range validation happens while constructing exact written `Note` values. Unsupported MIDI/register combinations reject with context and are never truncated or enharmonically substituted. Answer keys, grading, persistence, networking, audio analysis, and MIDI input remain deferred.
