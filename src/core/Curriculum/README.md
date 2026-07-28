# Curriculum Core

Curriculum v8.9 is a browser-free intent and orchestration layer over the existing Exercise and ExerciseSet boundaries. It never generates notes, interprets theory, lays out notation, or renders SVG.

## Templates and parameters

`ExerciseTemplate` identifies an existing `ExerciseType` family and describes instructional metadata, parameters, defaults, fixed constraints, and catalog validation sources. Parameter resolution is deterministic:

1. fixed constraints;
2. validated caller overrides for configurable parameters;
3. template defaults;
4. parameter defaults;
5. existing Exercise and ExerciseNotation defaults.

Unknown parameters reject with template and parameter identity. Overrides for constrained or non-overridable parameters reject rather than being ignored. Root spelling is passed unchanged, including Cb and B#. Duration values remain exact rational objects.

`DifficultyLevel` provides sortable `beginner`, `intermediate`, and `advanced` metadata. Difficulty does not change musical output. Prerequisite IDs are descriptive ordering metadata; curricula validate unit and lesson prerequisite graphs and the catalog validates curriculum prerequisites.

## Catalogs and expansion

`ExerciseTemplateCatalog` and `CurriculumCatalog` are plugin-scoped. Enumeration is stable by ID and independent of registration order. Values and snapshots are immutable; registration supports explicit replacement, removal, and restoration without leaking across plugin IDs.

`CurriculumEngine` resolves the active template, curriculum, Theory scale/chord, and Exercise progression catalogs. Template or curriculum expansion returns one ordinary immutable `ExerciseSetRequest`. Section/item metadata retains curriculum, unit, lesson, template/version, normalized parameter, and family traceability. `ExerciseSetApplication` remains the only worksheet execution boundary and provides contextual atomic downstream failure handling.

The built-in plugin supplies twelve templates covering scales, thirds, triad/seventh arpeggios, blocked chords, approaches, enclosures, ii–V–I studies, and twelve-bar blues. Three compact curricula demonstrate beginner fundamentals, intermediate harmony, and advanced chromatic language.

`CurriculumModule` uses transactional service and discovery registration. It resolves active dependencies during each configuration and removes only registrations it still owns on disposal.

## Deferred scope

Templates contain neither rendered SVG nor mutable React state. Persistence, publishing, networking, grading, audio, MIDI, PDF generation, downloads, and randomized variation are explicitly deferred.
