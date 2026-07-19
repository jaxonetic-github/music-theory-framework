import { PackageDescriptor } from "../../Foundation/index.js";

export const registriesPackageDescriptor = new PackageDescriptor({
    id: "core.infrastructure.registries",
    name: { value: "Infrastructure Registries", displayName: "Infrastructure Registries" },
    description: "Typed runtime registries for packages, modules, services, plugins, themes, generators, renderers, exporters, playback planners, and workspaces.",
    version: "6.1.0",
    layer: "infrastructure",
    category: "infrastructure",
    role: "registry",
    stability: "stable",
    visibility: "public",
    dependencies: [{ target: "core.foundation", kind: "required" }],
    capabilities: ["typed-registration", "alias-resolution", "registry-snapshots", "registry-events"],
    publicApi: [{ id: "core/Infrastructure/registries/index.js", kind: "module" }],
    metadata: { tags: ["infrastructure", "registry", "runtime"] }
});

export default registriesPackageDescriptor;
