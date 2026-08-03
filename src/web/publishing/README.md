# Publishing Web Adapter

`PublishingPanel` appears only beside a completed authoritative ExerciseSet or Curriculum worksheet. Draft page and metadata controls are separate from the source result and completed `PublishingResult`. A monotonic operation token plus material revision prevents stale completion from replacing a newer publication or worksheet; failure retains the last successful publication and reports the new error separately.

The page preview consumes `PublicationPlan` directly. React scales page containers for the host viewport but never paginates or measures canonical content. Pages are keyboard focusable and announce title, page number, count, status, errors, and stale state. The responsive preview is never the print source.

Printing snapshots the completed `PublishingResult`, re-emits only that result's immutable `PublicationPlan` through `HtmlPublishingStrategy` when the selected download format is not already HTML, and passes the resulting authoritative self-contained asset to `PublicationPrintController`. The controller creates one hidden same-origin `srcdoc` iframe, waits for that exact document to load, invokes its isolated `print()` once, and removes the iframe after success, failure, supersession, or owned-controller disposal. It never copies host DOM, uses draft metadata, repaginates, or prints unrelated application controls. Superseded jobs settle without printing; a component disposes only the controller it created, so injected caller-owned controllers retain caller ownership. The HTML asset supplies exact profile-sized point geometry, canonical line records, page breaks, and zero-margin `@page` rules independently of preview width or host CSS.

Downloads use completed asset media types and filenames, create no network request, and revoke every object URL in `finally`.

A contextual PDF geometry-validation failure follows the ordinary authoritative failure path: the last successful publication remains visible and stale, the new error is announced separately, and no print, download, iframe, Blob URL, or object URL is created automatically.

All browser APIs execute from user actions. Imports and server rendering remain free of `window`, `document`, object URLs, and print calls. Multiple embedded applications retain independent React state and renderer-owned accessible SVG IDs.
