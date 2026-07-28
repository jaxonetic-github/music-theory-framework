# Exercise Set and Worksheet Workflow

ExerciseSet v8.6 is a browser-free application package that groups ordered heterogeneous `ExerciseApplicationRequest` values into one immutable worksheet. `ExerciseSetRequest` validates title metadata, bounded nonempty sections, bounded nonempty item collections, caller-supplied identities, array-defined ordering, and every nested application request. Omitted IDs are deterministic functions of position and immutable request identity.

`ExerciseSetApplication` resolves through `ExerciseSetModule` and invokes the active `exercise.application.engine` sequentially once per item. Generated requests and supplied-model bypass requests therefore retain exact ExerciseApplication models, notation documents, independent ScoreGraphs, renderer identity, spelling, and semantic metadata. Each `ExerciseSetItem` owns the authoritative completed `ExerciseApplicationResult`; the worksheet never reconstructs musical content.

Any item failure is wrapped with section and item identity and prevents publication of a partial `ExerciseSetResult`. Requests, results, documents, sections, items, metadata, and nested collections are frozen. Limits are published through `EXERCISE_SET_LIMITS`: 32 sections, 64 items per section, 512 total items, and 160 characters per supplied or generated ID.

`boundedExerciseSetId()` is the shared browser-free downstream identity helper. It canonicalizes explicitly ordered semantic material with Foundation’s sorted-key serializer, retains a readable sanitized prefix, and appends a stable 64-bit FNV-1a hexadecimal digest. The complete result is bounded by `EXERCISE_SET_LIMITS.idLength`; callers retain full source identities separately in immutable metadata.

React, DOM, browser printing, audio, MIDI, transport, timers, grading, persistence, networking, downloads, filesystem access, and server behavior are outside this Core package.
