import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
export class ExerciseNotationSystem {
    constructor({ id, sequence, measureIds = [], metadata = {} } = {}) {
        if (!String(id ?? "").trim() || !Number.isSafeInteger(sequence) || sequence < 1) throw new ValidationError("Exercise notation systems require a stable id and positive sequence.");
        if (!Array.isArray(measureIds) || measureIds.length === 0 || new Set(measureIds.map(String)).size !== measureIds.length) throw new ValidationError("Exercise notation systems require unique measure identities.");
        Object.defineProperties(this, { id: { value: String(id), enumerable: true }, sequence: { value: sequence, enumerable: true }, measureIds: { value: Object.freeze(measureIds.map(String)), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } });
        Object.freeze(this);
    }
}
