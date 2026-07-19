import { CommandDescriptor, ServiceDescriptor } from "../Foundation/index.js";

export const applicationServiceDescriptors = Object.freeze({
    engine: new ServiceDescriptor({
        id: "application.engine", name: { value: "application-engine", displayName: "Music Theory Application" },
        description: "Coordinates generation, notation, optional rendering, and optional export through Kernel services.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        capabilities: ["headless-workflow", "service-orchestration", "immutable-results", "stage-context-errors", "plugin-passthrough"]
    })
});

export const applicationCommandDescriptors = Object.freeze({
    runWorkflow: new CommandDescriptor({
        id: "application.runWorkflow", name: { value: "run-workflow", displayName: "Run Application Workflow" },
        description: "Delegates a workflow request to the registered music theory application service.",
        layer: "application", category: "application", role: "service", stability: "stable", visibility: "public",
        handlers: [{ id: "application.engine", kind: "service" }]
    })
});
