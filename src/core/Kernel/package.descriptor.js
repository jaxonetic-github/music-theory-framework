import { PackageDescriptor } from "../Foundation/index.js";

export const kernelPackageDescriptor = new PackageDescriptor({
    id: "core.kernel",
    name: { value: "Kernel Runtime", displayName: "Kernel Runtime" },
    description: "Application runtime orchestration, lifecycle, dependency injection, events, and commands.",
    version: "6.1.0",
    layer: "infrastructure",
    category: "infrastructure",
    role: "service",
    stability: "stable",
    visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.infrastructure.registries", kind: "required" }
    ],
    capabilities: ["module-lifecycle", "dependency-injection", "event-dispatch", "command-dispatch"],
    publicApi: [{ id: "core/Kernel/index.js", kind: "module" }],
    metadata: { tags: ["kernel", "runtime", "lifecycle"] }
});

export default kernelPackageDescriptor;
