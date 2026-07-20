import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseModel } from "../Exercise/index.js";
import { ExerciseNotationDocument } from "../ExerciseNotation/index.js";
import { ExerciseApplicationRequest } from "./ExerciseApplicationRequest.js";
import { ExercisePresentationDocument } from "./ExercisePresentationDocument.js";
export class ExerciseApplicationResult {
    constructor({ request, model, notationDocument, presentation, metadata = {} } = {}) {
        if (!(request instanceof ExerciseApplicationRequest) || !(model instanceof ExerciseModel) || !(notationDocument instanceof ExerciseNotationDocument) || !(presentation instanceof ExercisePresentationDocument) || presentation.request !== request || presentation.model !== model || presentation.notationDocument !== notationDocument) throw new ValidationError("Invalid exercise application result.");
        Object.defineProperties(this, { request: { value: request, enumerable: true }, model: { value: model, enumerable: true }, notationDocument: { value: notationDocument, enumerable: true }, presentation: { value: presentation, enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
export default ExerciseApplicationResult;
