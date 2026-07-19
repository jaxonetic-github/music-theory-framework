export * from "./values/index.js";
export * from "./models/index.js";
export * from "./catalogs/index.js";
export * from "./generation/index.js";
export { theoryServiceDescriptors, theoryGeneratorDescriptors } from "./descriptors.js";
export { TheoryModule } from "./TheoryModule.js";
export { theoryPackageDescriptor } from "./package.descriptor.js";

import * as values from "./values/index.js";
import * as models from "./models/index.js";
import * as catalogs from "./catalogs/index.js";
import * as generation from "./generation/index.js";
import { theoryServiceDescriptors, theoryGeneratorDescriptors } from "./descriptors.js";
import { TheoryModule } from "./TheoryModule.js";
import { theoryPackageDescriptor } from "./package.descriptor.js";

export const Theory = Object.freeze({
    ...values, ...models, ...catalogs, ...generation,
    TheoryModule,
    serviceDescriptors: theoryServiceDescriptors,
    generatorDescriptors: theoryGeneratorDescriptors,
    descriptor: theoryPackageDescriptor
});

export default Theory;
