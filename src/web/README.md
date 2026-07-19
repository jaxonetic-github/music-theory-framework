# React Web Application Adapter

The v7.2 Web package is a React adapter over the headless `application.engine`. It does not contain theory generation, notation, SVG serialization, MusicXML serialization, registries, or workflow orchestration.

## Bootstrap and React integration

`createWebApplication()` creates one Kernel, installs `TheoryModule`, `NotationModule`, `RenderingModule`, `ExportModule`, and `ApplicationModule` in dependency order, starts it once, and resolves `application.engine`. It exposes only the application service and immutable scale/chord catalog choices to React. `dispose()` is reusable and shuts the Kernel down cleanly. Tests can inject a Kernel or module list.

`ApplicationProvider` owns this bootstrap lifecycle. `useApplicationRuntime()` exposes the safe runtime boundary and `useApplicationWorkflow()` provides empty, loading, success, and stage-aware error state. Generation tokens prevent stale or unmounted async workflow completions from changing React state.

Pure helpers in `workflow.js` build validated scale and chord `ApplicationRequest` values. Switching workflow types replaces `pattern` with `quality`, or vice versa, so contradictory request fields cannot survive. Pattern and quality controls come from the registered Theory catalogs rather than duplicated musical formulas.

## Trusted SVG boundary

The score view inserts SVG only from `ApplicationResult.rendering`, which is produced by the registered Rendering Core service. The UI never accepts SVG markup from a user and never reconstructs score notation. Dynamic SVG text and metadata escaping remain Rendering Core responsibilities.

## MusicXML download

`downloadExport()` is the browser-only delivery adapter. An explicit button action creates a Blob from immutable `ExportResult.content` and `mediaType`, generates a safe filename using its `extension`, clicks a temporary anchor, and always revokes the object URL. Export Core remains free of browser and filesystem behavior.

## Scope boundary

This package intentionally excludes playback, Web Audio, MIDI, authentication, persistence, networking, accounts, collaboration, server APIs, and external state management. Core imports remain React- and DOM-free.

## Validation

Milestone 9 passes **131 tests**: 120 plain-Node core and adapter tests plus 11 React DOM tests. Production validation uses `npm run build`, and the Vite build succeeds without requiring browser globals in Core.
