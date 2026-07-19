export * from "./strategies/index.js";
export { ExportResult } from "./ExportResult.js";
export { ExporterStrategyRegistry } from "./ExporterStrategyRegistry.js";
export { ExportEngine } from "./ExportEngine.js";
export { ExportModule } from "./ExportModule.js";
export { exportServiceDescriptors, exportExporterDescriptors, defaultExportPluginDescriptor } from "./descriptors.js";
export { exportPackageDescriptor } from "./package.descriptor.js";

import * as strategies from "./strategies/index.js";
import { ExportResult } from "./ExportResult.js";
import { ExporterStrategyRegistry } from "./ExporterStrategyRegistry.js";
import { ExportEngine } from "./ExportEngine.js";
import { ExportModule } from "./ExportModule.js";
import { exportServiceDescriptors, exportExporterDescriptors, defaultExportPluginDescriptor } from "./descriptors.js";
import { exportPackageDescriptor } from "./package.descriptor.js";

export const Export = Object.freeze({
    ...strategies,
    ExportResult,
    ExporterStrategyRegistry,
    ExportEngine,
    ExportModule,
    serviceDescriptors: exportServiceDescriptors,
    exporterDescriptors: exportExporterDescriptors,
    pluginDescriptor: defaultExportPluginDescriptor,
    descriptor: exportPackageDescriptor
});

export default Export;
