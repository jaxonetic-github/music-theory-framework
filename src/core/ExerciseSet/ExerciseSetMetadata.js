import { canonicalSerialize, cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";

export class ExerciseSetMetadata {
    constructor(value = {}) {
        if (value instanceof ExerciseSetMetadata) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Exercise set metadata must be an object.");
        try { canonicalSerialize(value); } catch (cause) { throw new ValidationError(`Exercise set metadata must be deterministically serializable: ${cause.message}`, { cause }); }
        for (const [key, entry] of Object.entries(value)) Object.defineProperty(this, key, { value: freezeDeep(cloneDeep(entry)), enumerable: true }); Object.freeze(this);
    }
    toJSON() { return Object.fromEntries(Object.entries(this)); }
}
export default ExerciseSetMetadata;
