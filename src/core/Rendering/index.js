export * from "./strategies/index.js";
export { RendererStrategyRegistry } from "./RendererStrategyRegistry.js";
export { RenderingEngine } from "./RenderingEngine.js";
export { RenderingModule } from "./RenderingModule.js";
export { renderingServiceDescriptors, renderingRendererDescriptors, defaultRenderingPluginDescriptor } from "./descriptors.js";
export { renderingPackageDescriptor } from "./package.descriptor.js";

import * as strategies from "./strategies/index.js";
import { RendererStrategyRegistry } from "./RendererStrategyRegistry.js";
import { RenderingEngine } from "./RenderingEngine.js";
import { RenderingModule } from "./RenderingModule.js";
import { renderingServiceDescriptors, renderingRendererDescriptors, defaultRenderingPluginDescriptor } from "./descriptors.js";
import { renderingPackageDescriptor } from "./package.descriptor.js";

export const Rendering = Object.freeze({
    ...strategies,
    RendererStrategyRegistry,
    RenderingEngine,
    RenderingModule,
    serviceDescriptors: renderingServiceDescriptors,
    rendererDescriptors: renderingRendererDescriptors,
    pluginDescriptor: defaultRenderingPluginDescriptor,
    descriptor: renderingPackageDescriptor
});

export default Rendering;
