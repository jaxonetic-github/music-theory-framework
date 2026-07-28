# Worksheet Publishing Core

Publishing v9.0 consumes an authoritative completed `ExerciseSetResult`; it never regenerates Theory, Exercise, Notation, or Curriculum content. `PublicationPlanner` converts the immutable worksheet hierarchy and each row's authoritative `LayoutPlan` plus trusted conventional SVG into typed immutable blocks and pages. Source metadata retains exercise-set, section, item, row, system, ScoreGraph, template, curriculum, unit, lesson, and plugin provenance when present.

## Page units and profiles

Canonical page geometry uses integer hundredths of a PostScript point (`PUBLISHING_UNITS_PER_POINT = 100`), never CSS pixels or DOM measurements. Built-ins are US Letter portrait/landscape (`612 × 792 pt`) and A4 portrait/landscape (`595.28 × 841.89 pt`). `PageProfile` supports validated custom dimensions, margins, header/footer reservations, and minimum content bounds.

## Pagination

The planner preserves section, item, row, and system order. It uses explicit heading and spacing metrics, keeps an exercise heading with its first notation row, and never splits a trusted notation row or any system inside it. Notation scales from the existing print layout into printable width down to a documented minimum of 0.36 point per renderer unit; an indivisible row that still does not fit rejects contextually rather than clipping. Page and block IDs use the shared bounded deterministic ExerciseSet identity helper.

The current orphan rule keeps each item heading with its first notation block. The planner does not perform general prose composition or widow balancing, and it treats a multi-system authoritative row as one indivisible vector block. Re-layout is deliberately deferred until the downstream presentation contract exposes independently renderable authoritative systems.

## Formats

- `HtmlPublishingStrategy` emits self-contained semantic HTML, explicit page containers, exact `@page` geometry, print CSS, escaped caller text, no scripts, and trusted embedded SVG.
- `SvgPublishingStrategy` emits one ordered, accessible, explicitly sized SVG asset per page and namespaces known source SVG IDs.
- `PdfPublishingStrategy` is a repository-owned, dependency-free PDF 1.7 adapter. It writes stable objects in stable order, omits clocks and random document IDs, converts the renderer's line, circle, ellipse, and path primitives (including translated glyph groups) to PDF vector operators, and produces byte-identical output for equivalent requests. SVG ellipse rotation is normalized to an axis-aligned PDF ellipse, a small typography difference; musical identity and placement remain intact. HTML and SVG preserve the source vectors exactly.

No PDF dependency was added, so there is no third-party license, vulnerability, SSR, or bundle-loading cost. PDF output is not a tagged PDF and does not claim PDF/UA compliance.

## Metadata, filenames, and lifecycle

Dates and creation labels are caller-supplied only. Safe filename bases contain no paths or controls and derive from the completed authoritative title when omitted. `PublishingStrategyRegistry` is plugin-scoped with deterministic selection. `PublishingModule` resolves active Layout, Rendering, Export, and ExerciseSet services on each lifecycle and transactionally registers its engine, registry, plugin, and built-ins.

Answer keys, grading, persistence, accounts, networking, audio, server APIs, and general document authoring remain deferred.
