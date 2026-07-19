export { ApplicationRequest } from "./ApplicationRequest.js";
export { RenderingOutput } from "./RenderingOutput.js";
export { ApplicationResult } from "./ApplicationResult.js";
export { ApplicationWorkflowError } from "./ApplicationWorkflowError.js";
export { MusicTheoryApplication } from "./MusicTheoryApplication.js";
export { ApplicationModule } from "./ApplicationModule.js";
export { applicationServiceDescriptors, applicationCommandDescriptors } from "./descriptors.js";
export { applicationPackageDescriptor } from "./package.descriptor.js";

import { ApplicationRequest } from "./ApplicationRequest.js";
import { RenderingOutput } from "./RenderingOutput.js";
import { ApplicationResult } from "./ApplicationResult.js";
import { ApplicationWorkflowError } from "./ApplicationWorkflowError.js";
import { MusicTheoryApplication } from "./MusicTheoryApplication.js";
import { ApplicationModule } from "./ApplicationModule.js";
import { applicationServiceDescriptors, applicationCommandDescriptors } from "./descriptors.js";
import { applicationPackageDescriptor } from "./package.descriptor.js";

export const Application = Object.freeze({
    ApplicationRequest,
    RenderingOutput,
    ApplicationResult,
    ApplicationWorkflowError,
    MusicTheoryApplication,
    ApplicationModule,
    serviceDescriptors: applicationServiceDescriptors,
    commandDescriptors: applicationCommandDescriptors,
    descriptor: applicationPackageDescriptor
});

export default Application;
