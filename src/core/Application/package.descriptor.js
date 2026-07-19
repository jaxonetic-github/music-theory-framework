import { PackageDescriptor } from "../Foundation/index.js";

export const applicationPackageDescriptor = new PackageDescriptor({
    id: "core.application",
    name: { value: "application", displayName: "Application Workflow Core" },
    description: "Framework-neutral orchestration of theory generation, notation, rendering, and export services.",
    version: "7.1.0",
    layer: "application",
    category: "application",
    role: "provider",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.infrastructure.registries", kind: "required" },
        { target: "core.kernel", kind: "required" },
        { target: "core.theory", kind: "required" },
        { target: "core.notation", kind: "required" },
        { target: "core.rendering", kind: "optional" },
        { target: "core.export", kind: "optional" }
    ],
    capabilities: ["headless-workflow", "scale-workflow", "chord-workflow", "optional-rendering", "optional-export", "plugin-passthrough", "stage-context-errors"],
    consumes: [
        { id: "theory.scaleGenerator", kind: "service" },
        { id: "theory.chordGenerator", kind: "service" },
        { id: "notation.engine", kind: "service" },
        { id: "rendering.engine", kind: "service" },
        { id: "export.engine", kind: "service" }
    ],
    provides: [
        { id: "application.engine", kind: "service" },
        { id: "application.runWorkflow", kind: "command" }
    ],
    publicApi: [{ id: "core/Application/index.js", kind: "module" }],
    metadata: { tags: ["application", "workflow", "orchestration", "headless"] }
});

export default applicationPackageDescriptor;
