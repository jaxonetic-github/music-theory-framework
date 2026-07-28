# Publishing Web Adapter

`PublishingPanel` appears only beside a completed authoritative ExerciseSet or Curriculum worksheet. Draft page and metadata controls are separate from the source result and completed `PublishingResult`. A monotonic operation token plus material revision prevents stale completion from replacing a newer publication or worksheet; failure retains the last successful publication and reports the new error separately.

The page preview consumes `PublicationPlan` directly. React scales page containers for the host viewport but never paginates or measures canonical content. Pages are keyboard focusable and announce title, page number, count, status, errors, and stale state. Browser print temporarily scopes print CSS to publication pages and restores the root class in `finally`. Downloads use completed asset media types and filenames, create no network request, and revoke every object URL in `finally`.

All browser APIs execute from user actions. Imports and server rendering remain free of `window`, `document`, object URLs, and print calls. Multiple embedded applications retain independent React state and renderer-owned accessible SVG IDs.
