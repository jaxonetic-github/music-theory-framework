export { RegistrationRecord } from "./RegistrationRecord.js";
export { RegistrySnapshot } from "./RegistrySnapshot.js";
export { Registry } from "./Registry.js";
export { PackageRegistry } from "./PackageRegistry.js";
export { ModuleRegistry } from "./ModuleRegistry.js";
export { ServiceRegistry } from "./ServiceRegistry.js";
export { PluginRegistry } from "./PluginRegistry.js";
export { ThemeRegistry } from "./ThemeRegistry.js";
export { GeneratorRegistry } from "./GeneratorRegistry.js";
export { RendererRegistry } from "./RendererRegistry.js";
export { ExporterRegistry } from "./ExporterRegistry.js";
export { WorkspaceRegistry } from "./WorkspaceRegistry.js";
export { registriesPackageDescriptor } from "./package.descriptor.js";

import { RegistrationRecord } from "./RegistrationRecord.js";
import { RegistrySnapshot } from "./RegistrySnapshot.js";
import { Registry } from "./Registry.js";
import { PackageRegistry } from "./PackageRegistry.js";
import { ModuleRegistry } from "./ModuleRegistry.js";
import { ServiceRegistry } from "./ServiceRegistry.js";
import { PluginRegistry } from "./PluginRegistry.js";
import { ThemeRegistry } from "./ThemeRegistry.js";
import { GeneratorRegistry } from "./GeneratorRegistry.js";
import { RendererRegistry } from "./RendererRegistry.js";
import { ExporterRegistry } from "./ExporterRegistry.js";
import { WorkspaceRegistry } from "./WorkspaceRegistry.js";
import { registriesPackageDescriptor } from "./package.descriptor.js";

export const Registries = Object.freeze({
    RegistrationRecord,
    RegistrySnapshot,
    Registry,
    PackageRegistry,
    ModuleRegistry,
    ServiceRegistry,
    PluginRegistry,
    ThemeRegistry,
    GeneratorRegistry,
    RendererRegistry,
    ExporterRegistry,
    WorkspaceRegistry,
    descriptor: registriesPackageDescriptor
});

export default Registries;
