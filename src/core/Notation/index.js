export * from "./values/index.js";
export * from "./graph/index.js";
export * from "./strategies/index.js";
export { NotationStrategyRegistry } from "./NotationStrategyRegistry.js";
export { NotationEngine } from "./NotationEngine.js";
export { NotationModule } from "./NotationModule.js";
export { notationServiceDescriptors, notationRendererDescriptors, defaultNotationPluginDescriptor } from "./descriptors.js";
export { notationPackageDescriptor } from "./package.descriptor.js";

import * as values from "./values/index.js";
import * as graph from "./graph/index.js";
import * as strategies from "./strategies/index.js";
import { NotationStrategyRegistry } from "./NotationStrategyRegistry.js";
import { NotationEngine } from "./NotationEngine.js";
import { NotationModule } from "./NotationModule.js";
import { notationServiceDescriptors, notationRendererDescriptors, defaultNotationPluginDescriptor } from "./descriptors.js";
import { notationPackageDescriptor } from "./package.descriptor.js";

export const Notation = Object.freeze({
    ...values, ...graph, ...strategies,
    NotationStrategyRegistry,
    NotationEngine,
    NotationModule,
    serviceDescriptors: notationServiceDescriptors,
    rendererDescriptors: notationRendererDescriptors,
    pluginDescriptor: defaultNotationPluginDescriptor,
    descriptor: notationPackageDescriptor
});

export default Notation;
