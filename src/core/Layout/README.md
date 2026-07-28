# Responsive Engraving Layout

Layout v8.8 is the browser-free boundary between immutable Notation `ScoreGraph` data and visual placement. A `LayoutRequest` combines one graph with an explicit available width, deterministic profile, padding and spacing values, and optional ExerciseNotation semantic-system hints. `LayoutEngine` selects a plugin-scoped `LayoutStrategy`; the default `ScoreGraphLayoutStrategy` returns a deeply immutable `LayoutPlan` containing systems, measures, event placements, bounds, and metadata.

## Units and profiles

One layout unit is an abstract deterministic engraving unit. The Web adapter currently maps one CSS pixel to one layout unit after integer normalization, but Core never reads a viewport, CSS, fonts, device-pixel ratio, or DOM geometry. Supported widths are 160 through 10,000 units.

The frozen profiles are `screen-compact`, `screen-regular`, and `print-worksheet`. Each declares explicit staff-line spacing, staff height, clef/key/meter allowances, accidental columns, notehead/stem/flag/rest widths, event gaps, barlines, measure padding, and vertical spacing. Callers may select a profile by identity; malformed profiles and unsafe numeric options are rejected.

The original public `LayoutProfile` fields remain `id`, `eventGap`, `measurePadding`, `clefWidth`, `keySignatureWidth`, `barlineWidth`, `staffHeight`, `staffSpacing`, and `systemSpacing`. Previously valid construction with only those fields remains compatible. New engraving metrics are optional and normalize from the single frozen `engravingMetricDefaults` export: `timeSignatureWidth: 42`, `accidentalWidth: 18`, `noteheadWidth: 18`, `stemWidth: 4`, `flagWidth: 14`, `restWidth: 22`, `augmentationDotWidth: 7`, and `staffLineSpacing: 12`. Omission and explicit `undefined` both select the default. Explicit overrides must be positive finite numbers; legacy-field validation remains non-negative and unchanged. Construction does not mutate its input, serialized legacy objects may be passed back through `new LayoutProfile(...)`, and the resulting normalized profile is frozen.

## Ordering and system breaking

Containment determines parts, measures, and voices. Authoritative `next` edges determine event precedence within each voice, with canonical offset and node-ID ties matching the other ScoreGraph consumers. Raw offset remains ordering metadata: layout never treats it as pixel distance or musical time. Layout accumulates exact rational durations—including rests—into each placement's frozen normalized `onset`, then merges all voices into the measure's chronological `eventPlacements` stream. Every unique onset owns one shared horizontal anchor. Its left and right extents are the maxima required by all simultaneous glyphs; the next column advances by those combined extents plus the profile's fixed event gap. This density-spacing rule aligns simultaneous events, strictly advances later onsets, and makes natural width independent of voice registration order without floating-point rhythmic scaling. Renderers consume this contract rather than reconstructing musical time. Reversing input node, edge, voice, offset, or chord-member arrays therefore produces equivalent placement geometry.

Measures remain ordered and atomic events—including chords—are never divided. The planner prefers measure boundaries, starts mandatory semantic systems at a new visual system, and may wrap measures inside compatible semantic systems. Visual-system IDs derive from score, profile, part, sequence, and boundary measure identities rather than input-array order. Different parts remain independent.

If a single measure exceeds the content width, it receives one overflow-marked system at its uncompressed natural width. Core never squeezes glyph spacing until overlap is likely. The Web presentation exposes this state and allows localized horizontal overflow.

## Spacing and preservation

Fixed metrics reserve room for clefs, key signatures, meters, measure padding, barlines, event gaps, rests, duration-specific notes, chord seconds, flags, augmentation dots, exact-ratio indicators, and separate accidental columns. A shared exact-rational classifier supplies binary base value, hook/flag count, and zero through three dots when exact. Dyadic values extend deterministically through a 1/4096 base, including 1/128; every other valid positive rational selects the immediately longer binary base and retains its normalized exact ratio as a renderer-owned tuplet indicator. No duration is rounded or changed. These metrics cover the framework's current glyph domain, including naturals, flats, sharps, double sharps, Cb, B#, triads, and seventh chords, without DOM or font bounding boxes. Visual systems use five lines at a fixed 12-unit spacing and explicit inter-system whitespace. Full page pagination remains deferred.

Every visual-system start reserves a clef plus the active key and meter. Interior measure boundaries reserve header width only when the key or meter changes. The shared immutable key transition compares previous and new alterations by written step, cancels only removed or changed entries in prior-signature order, then emits the complete new signature in its conventional order. Its cancellation list and glyph counts drive the same frozen boundary calculation used by system breaking, measure width, event placement, SVG emission, and accessibility, so retained accidentals are not redundantly cancelled and the first event cannot overlap a changed signature.

Layout preserves node identities, written pitch spelling, MIDI data, durations, offsets, part/measure/voice membership, chord membership and order, source metadata, semantic row/system identity, and `next` edges. It never mutates the graph or changes playback/export ordering.

## Rendering and exercise workflows

`RenderingEngine` obtains or accepts a validated `LayoutPlan`, and `SvgScoreRenderer` emits placements directly from that plan; completed SVG is never parsed or repositioned. Legacy rendering requests use the `screen-regular` profile and its documented default width. ExerciseApplication supplies each row's semantic system hints and retains the exact plan and layout metadata. ExerciseSetApplication therefore preserves per-item plans and its existing contextual, atomic failure behavior.

The React adapter uses `ResizeObserver` only inside mounted effects. It coalesces observations, ignores transient zero or duplicate widths, reruns layout/rendering without regenerating music, rejects stale completions, and disconnects on unmount. Imports remain safe for Next.js server analysis. Scoped responsive and print styles remain beneath `.music-theory-app`.

Pagination and PDF publishing, downloads, audio, Transport, MIDI, persistence, networking, and grading are explicitly deferred.
