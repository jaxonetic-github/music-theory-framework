export * from "./assertions/index.js";
export * from "./collections/index.js";
export * from "./contracts/index.js";
export * from "./descriptors/index.js";
export * from "./enums/index.js";
export * from "./errors/index.js";
export * from "./utilities/index.js";
export * from "./values/index.js";
export { foundationPackageDescriptor } from "./package.descriptor.js";

import * as assertions from "./assertions/index.js";
import * as collections from "./collections/index.js";
import * as contracts from "./contracts/index.js";
import * as descriptors from "./descriptors/index.js";
import * as enums from "./enums/index.js";
import * as errors from "./errors/index.js";
import * as utilities from "./utilities/index.js";
import * as values from "./values/index.js";
import { foundationPackageDescriptor } from "./package.descriptor.js";

export const Foundation = Object.freeze({
    ...assertions,
    ...collections,
    ...contracts,
    ...descriptors,
    ...enums,
    ...errors,
    ...utilities,
    ...values,
    descriptor: foundationPackageDescriptor
});

export default Foundation;
