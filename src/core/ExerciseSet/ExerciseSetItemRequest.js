import { Identifier, ValidationError } from "../Foundation/index.js";
import { ExerciseApplicationRequest } from "../ExerciseApplication/index.js";
import { EXERCISE_SET_LIMITS } from "./limits.js";

const keys = new Set(["id", "label", "order", "application"]);
function text(value, label, { required = false, max = EXERCISE_SET_LIMITS.labelLength } = {}) {
    if (value === undefined || value === null) { if (required) throw new ValidationError(`${label} is required.`); return null; }
    const result = String(value).trim(); if (!result || result.length > max) throw new ValidationError(`${label} must be a non-empty string of at most ${max} characters.`); return result;
}
export class ExerciseSetItemRequest {
    constructor(value = {}, { sectionId, sequence } = {}) {
        if (value instanceof ExerciseSetItemRequest) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Exercise set item must be an object.");
        const unknown = Object.keys(value).filter(key => !keys.has(key)); if (unknown.length) throw new ValidationError(`Unknown exercise set item option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
        if (!Number.isSafeInteger(sequence) || sequence < 1) throw new ValidationError("Exercise set item sequence must be a positive safe integer.");
        if (value.order !== undefined && (!Number.isSafeInteger(value.order) || value.order !== sequence)) throw new ValidationError(`Exercise set item order must match its position (${sequence}).`);
        let application; try { application = ExerciseApplicationRequest.from(value.application); } catch (cause) { throw new ValidationError(`Invalid exercise application request: ${cause.message}`, { cause }); }
        let supplied = null; if (value.id !== undefined && value.id !== null) { try { supplied = String(Identifier.from(value.id)); if (supplied.length > EXERCISE_SET_LIMITS.labelLength) throw new Error(`identifier exceeds ${EXERCISE_SET_LIMITS.labelLength} characters`); } catch (cause) { throw new ValidationError(`Invalid exercise set item id: ${cause.message}`, { cause }); } }
        const id = supplied ?? `${sectionId}:item:${sequence}`;
        Object.defineProperties(this, { id: { value: id, enumerable: true }, label: { value: text(value.label, "Exercise set item label"), enumerable: true }, sequence: { value: sequence, enumerable: true }, application: { value: application, enumerable: true }, callerSuppliedId: { value: supplied !== null, enumerable: true } }); Object.freeze(this);
    }
}
export default ExerciseSetItemRequest;
