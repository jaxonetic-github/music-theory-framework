# Curriculum Browser

The v8.9 Curriculum browser receives immutable choices from the active Core template, curriculum, Theory, and progression catalogs. React contains filtering and form presentation only; expansion remains in `CurriculumEngine` and worksheet execution remains in `ExerciseSetApplication`.

Templates can be filtered by family, difficulty, and skill. Fixed constraints are exposed as non-editable descriptions, while configurable parameters use their Core contracts and catalog-derived choices. Curricula expose ordered units, lessons, objectives, prerequisites, and complete- or lesson-level expansion.

Draft selection and overrides are distinct from the last authoritative expansion and worksheet result. Curriculum lesson controls select a unit first and derive lessons only from that unit, so repeated lesson IDs remain unambiguous. Changing units clears the lesson selection.

A material edit or an actual Templates/Curricula mode transition marks completed output stale without mutating it. Selecting the already active mode is a no-op. A mode transition also invalidates in-flight work from the previous mode. Monotonic operation identities prevent stale asynchronous completion from replacing newer output, and an error leaves the previous successful worksheet visible.

Results reuse `ExerciseSetWorksheet`, trusted-SVG validation, responsive conventional engraving, instance-safe accessible IDs, and print styles. Server rendering and module analysis perform no browser access. Audio, grading, persistence, downloads, publishing, and networking are not part of this workflow.
