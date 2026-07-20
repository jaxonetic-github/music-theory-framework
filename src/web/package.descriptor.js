import { PackageDescriptor } from "../core/index.js";

export const reactWebPackageDescriptor = new PackageDescriptor({
    id: "web.react-application",
    name: { value: "react-web-application", displayName: "React Web Application Adapter" },
    description: "Accessible React workflows for general generation, playback, and exercise practice presentation.",
    version: "8.5.0",
    layer: "presentation",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.theory", kind: "required" },
        { target: "core.notation", kind: "required" },
        { target: "core.rendering", kind: "required" },
        { target: "core.exercise", kind: "required" },
        { target: "core.exercise-notation", kind: "required" },
        { target: "core.exercise-application", kind: "required" },
        { target: "core.export", kind: "required" },
        { target: "core.application", kind: "required" },
        { target: "core.playback", kind: "required" },
        { target: "web.audio-playback", kind: "required" },
        { target: "web.playback-transport", kind: "required" }
    ],
    capabilities: ["react-adapter", "accessible-workflow", "accessible-exercise-practice", "advanced-exercise-practice", "accessible-playback-controls", "transport-subscription", "trusted-svg-view", "musicxml-download", "responsive-layout"],
    consumes: [
        { id: "application.engine", kind: "service" },
        { id: "exercise.application.engine", kind: "service" },
        { id: "theory.scaleCatalog", kind: "service" },
        { id: "theory.chordCatalog", kind: "service" },
        { id: "exercise.progressionCatalog", kind: "service" },
        { id: "playback.engine", kind: "service" },
        { id: "web.playback.transport", kind: "service" }
    ],
    provides: [{ id: "web.react-application", kind: "module" }],
    publicApi: [{ id: "web/index.js", kind: "module" }],
    metadata: { tags: ["web", "react", "accessibility", "playback", "transport", "adapter"] }
});

export default reactWebPackageDescriptor;
