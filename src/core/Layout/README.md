# Responsive Engraving Layout

Layout v8.8 is the browser-free boundary between immutable Notation `ScoreGraph` data and visual placement. A `LayoutRequest` combines one graph with an explicit available width, deterministic profile, padding and spacing values, and optional ExerciseNotation semantic-system hints. `LayoutEngine` selects a plugin-scoped `LayoutStrategy`; the default `ScoreGraphLayoutStrategy` returns a deeply immutable `LayoutPlan` containing systems, measures, event placements, bounds, and metadata.

## Units and profiles

One layout unit is an abstract deterministic engraving unit. The Web adapter currently maps one CSS pixel to one layout unit after integer normalization, but Core never reads a viewport, CSS, fonts, device-pixel ratio, or DOM geometry. Supported widths are 160 through 10,000 units.

The frozen profiles are `screen-compact`, `screen-regular`, and `print-worksheet`. Each declares explicit staff height, clef width, key-signature allowance, event gap, barline width, measure padding, and default vertical spacing. Callers may select a profile by identity; malformed profiles and unsafe numeric options are rejected.

## Ordering and system breaking

Containment determines parts, measures, and voices. Authoritative `next` edges determine event precedence, with canonical offset and node-ID ties matching the other ScoreGraph consumers. Offset remains ordering metadata: layout never treats it as pixel distance or musical duration. Reversing input node or edge arrays therefore produces an equivalent plan.

Measures remain ordered and atomic events—including chords—are never divided. The planner prefers measure boundaries, starts mandatory semantic systems at a new visual system, and may wrap measures inside compatible semantic systems. Visual-system IDs derive from score, profile, part, sequence, and boundary measure identities rather than input-array order. Different parts remain independent.

If a single measure exceeds the content width, it receives one overflow-marked system at its uncompressed natural width. Core never squeezes glyph spacing until overlap is likely. The Web presentation exposes this state and allows localized horizontal overflow.

## Spacing and preservation

Fixed metrics reserve room for clefs, key signatures, measure padding, barlines, event gaps, rests, notes, chord density, and accidental columns. These metrics cover the framework's current glyph domain, including flats, sharps, Cb, B#, triads, and seventh chords, without DOM bounding boxes. Vertical positions use explicit staff height, per-voice spacing, and inter-system spacing, so systems do not overlap. Full page pagination remains deferred.

Layout preserves node identities, written pitch spelling, MIDI data, durations, offsets, part/measure/voice membership, chord membership and order, source metadata, semantic row/system identity, and `next` edges. It never mutates the graph or changes playback/export ordering.

## Rendering and exercise workflows

`RenderingEngine` obtains or accepts a validated `LayoutPlan`, and `SvgScoreRenderer` emits placements directly from that plan; completed SVG is never parsed or repositioned. Legacy rendering requests use the `screen-regular` profile and its documented default width. ExerciseApplication supplies each row's semantic system hints and retains the exact plan and layout metadata. ExerciseSetApplication therefore preserves per-item plans and its existing contextual, atomic failure behavior.

The React adapter uses `ResizeObserver` only inside mounted effects. It coalesces observations, ignores transient zero or duplicate widths, reruns layout/rendering without regenerating music, rejects stale completions, and disconnects on unmount. Imports remain safe for Next.js server analysis. Scoped responsive and print styles remain beneath `.music-theory-app`.

Pagination and PDF publishing, downloads, audio, Transport, MIDI, persistence, networking, and grading are explicitly deferred.
