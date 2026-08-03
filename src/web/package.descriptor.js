import { PackageDescriptor } from "../core/index.js";

export const reactWebPackageDescriptor = new PackageDescriptor({
    id: "web.react-application",
    name: { value: "react-web-application", displayName: "React Web Application Adapter" },
    description: "Accessible React workflows for generation, playback, exercise practice, curricula, and worksheet publishing.",
    version: "9.0.0",
    layer: "presentation",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.theory", kind: "required" },
        { target: "core.notation", kind: "required" },
        { target: "core.layout", kind: "required" },
        { target: "core.rendering", kind: "required" },
        { target: "core.exercise", kind: "required" },
        { target: "core.exercise-notation", kind: "required" },
        { target: "core.exercise-application", kind: "required" },
        { target: "core.exercise-set", kind: "required" },
        { target: "core.curriculum", kind: "required" },
        { target: "core.export", kind: "required" },
        { target: "core.publishing", kind: "required" },
        { target: "core.application", kind: "required" },
        { target: "core.playback", kind: "required" },
        { target: "web.audio-playback", kind: "required" },
        { target: "web.playback-transport", kind: "required" }
    ],
    capabilities: ["react-adapter", "embeddable-application", "nextjs-client-boundary", "scoped-styles", "accessible-workflow", "accessible-exercise-practice", "advanced-exercise-practice", "exercise-worksheet", "exercise-template-browser", "curriculum-browser", "worksheet-publishing", "page-preview", "print", "asset-download", "responsive-engraving", "resize-observer-adapter", "accessible-playback-controls", "transport-subscription", "trusted-svg-view", "musicxml-download", "responsive-layout", "print-styles"],
    consumes: [
        { id: "application.engine", kind: "service" },
        { id: "exercise.application.engine", kind: "service" },
        { id: "exercise.set.application", kind: "service" },
        { id: "curriculum.engine", kind: "service" },
        { id: "curriculum.template-catalog", kind: "service" },
        { id: "curriculum.catalog", kind: "service" },
        { id: "theory.scaleCatalog", kind: "service" },
        { id: "theory.chordCatalog", kind: "service" },
        { id: "exercise.progressionCatalog", kind: "service" },
        { id: "layout.engine", kind: "service" },
        { id: "publishing.engine", kind: "service" },
        { id: "playback.engine", kind: "service" },
        { id: "web.playback.transport", kind: "service" }
    ],
    provides: [{ id: "web.react-application", kind: "module" }],
    publicApi: [{ id: "web/index.js", kind: "module" }, { id: "web/next/index.js", kind: "module" }, { id: "web/styles.css", kind: "module" }],
    metadata: { tags: ["web", "react", "nextjs", "embedding", "accessibility", "playback", "transport", "adapter"] }
});

export default reactWebPackageDescriptor;
