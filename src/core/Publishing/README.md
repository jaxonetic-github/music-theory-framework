# Worksheet Publishing Core

Publishing v9.0 consumes an authoritative completed `ExerciseSetResult`; it never regenerates Theory, Exercise, Notation, or Curriculum content. `PublicationPlanner` converts the immutable worksheet hierarchy and each row's authoritative `LayoutPlan` plus trusted conventional SVG into typed immutable blocks and pages. Source metadata retains exercise-set, section, item, row, system, ScoreGraph, template, curriculum, unit, lesson, and plugin provenance when present.

## Page units and profiles

Canonical page geometry uses integer hundredths of a PostScript point (`PUBLISHING_UNITS_PER_POINT = 100`), never CSS pixels or DOM measurements. Built-ins are US Letter portrait/landscape (`612 × 792 pt`) and A4 portrait/landscape (`595.28 × 841.89 pt`). `PageProfile` supports validated custom dimensions, margins, header/footer reservations, and minimum content bounds.

## Pagination

The planner preserves section, item, row, and system order. It uses explicit heading and spacing metrics, keeps an exercise heading with its first notation row, and never splits a trusted notation row or any system inside it. Notation scales from the existing print layout into printable width down to a documented minimum of 0.36 point per renderer unit; an indivisible row that still does not fit rejects contextually rather than clipping. Page and block IDs use the shared bounded deterministic ExerciseSet identity helper.

The current orphan rule keeps each item heading with its first notation block. The planner does not perform general prose composition or widow balancing, and it treats a multi-system authoritative row as one indivisible vector block. Re-layout is deliberately deferred until the downstream presentation contract exposes independently renderable authoritative systems.

Page headers capture an immutable context when the first content block enters a page. With `section-title`, a page beginning in Section A keeps Section A even if Section B starts later on that page; the visible Section B heading marks that transition, and the next page uses Section B. A section heading that forces a break finalizes the old page before the active section changes, so later planner state can never relabel an earlier page. Document-title and no-header policies use the same page-local finalization path.

## Canonical text layout

`layoutPublicationText()` is the single browser-free line planner used by pagination and the HTML, SVG, and PDF emitters. It uses explicit immutable typography categories, integer publishing units, and conservative one-em glyph bounds rather than DOM or platform font measurement. Inline whitespace is normalized to one space, explicit newlines are honored, empty lines preserve paragraph breaks, and an overlong token is split deterministically by Unicode code point. Every frozen line record carries its text, measured width, one-based index, vertical offset, line height, and source-text identity. Planner height is exactly line count times canonical line height. SVG emits explicit `tspan` lines, HTML emits explicit block lines, and PDF writes the same sequence; no format performs a second wrapping pass.

## Formats

- `HtmlPublishingStrategy` emits self-contained semantic HTML, explicit fixed-size page containers, exact `@page` width/height with zero outer margin, point-based block and line metrics, escaped caller text, no scripts, and trusted embedded SVG. Letter, A4, and custom profiles retain their authoritative dimensions and orientation without viewport-dependent print overrides.
- `SvgPublishingStrategy` emits one ordered, accessible, explicitly sized SVG asset per page and namespaces known source SVG IDs.
- `PdfPublishingStrategy` is a repository-owned, dependency-free PDF 1.7 adapter. It writes stable objects in stable order, omits clocks and random document IDs, converts the renderer's line, circle, ellipse, path, and simple text primitives to PDF vector operators, and produces byte-identical output for equivalent requests. Every group and element carries a deterministic six-value affine matrix. Transform lists are composed in SVG order, child matrices compose under their parent, and each primitive is emitted inside an isolated PDF `q … cm … Q` graphics state; this preserves translated glyphs, rotated filled/open noteheads, nested transformations, transformed paths, and sibling isolation while scaling strokes through the PDF current transformation matrix.

  Supported transforms are `translate(tx)`, `translate(tx ty)`, `scale(s)`, `scale(sx sy)`, `rotate(angle)`, `rotate(angle cx cy)`, `matrix(a b c d e f)`, lists of those transforms, and nested group/element combinations. Malformed lists and every other transform, including skew functions, reject contextually. A stack-scoped presentation context independently carries `fill`, `stroke`, `color`/`currentColor`, fill/stroke opacity, group opacity, fill rule, and stroke width/caps/joins; child overrides and sibling restoration follow SVG inheritance. Black, white, and `none` paint are supported, as are nonzero/evenodd fill operations and combined fill/stroke. Unsupported paint colors, path commands, nested text markup, and visible `rect`, polygon/polyline, image/use, clipping, mask, or foreign-object constructs reject instead of being silently misrepresented.

No PDF dependency was added, so there is no third-party license, vulnerability, SSR, or bundle-loading cost. PDF output is not a tagged PDF and does not claim PDF/UA compliance.

## Metadata, filenames, and lifecycle

Dates and creation labels are caller-supplied only. Safe filename bases contain no paths or controls and derive from the completed authoritative title when omitted. `PublishingStrategyRegistry` is plugin-scoped with deterministic selection. `PublishingModule` resolves active Layout, Rendering, Export, and ExerciseSet services on each lifecycle and transactionally registers its engine, registry, plugin, and built-ins.

Answer keys, grading, persistence, accounts, networking, audio, server APIs, and general document authoring remain deferred.
