import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { Note } from "../Theory/index.js";

export class ExerciseStep {
    constructor({ id, sequence, sourceId, notes = [], simultaneous = false, role = null, scaleDegree = null, chordMembers = [], metadata = {} } = {}) {
        const normalizedId = String(id ?? "").trim();
        const normalizedSource = String(sourceId ?? "").trim();
        if (!normalizedId || !normalizedSource) throw new ValidationError("Exercise steps require id and sourceId.");
        if (!Number.isSafeInteger(sequence) || sequence < 1) throw new ValidationError("Exercise step sequence must be a positive safe integer.");
        if (!Array.isArray(notes) || notes.length === 0 || notes.some(note => !(note instanceof Note))) {
            throw new ValidationError("Exercise steps require one or more Note values.");
        }
        if (typeof simultaneous !== "boolean") throw new ValidationError("Exercise step simultaneous must be a boolean.");
        if (simultaneous && notes.length < 2) throw new ValidationError("A simultaneous exercise step requires multiple notes.");
        if (scaleDegree !== null && (!Number.isSafeInteger(scaleDegree) || scaleDegree < 1)) throw new ValidationError("Exercise scaleDegree must be a positive integer or null.");
        if (!Array.isArray(chordMembers) || chordMembers.some(member => !Number.isSafeInteger(member) || member < 1)) {
            throw new ValidationError("Exercise chord members must be positive integers.");
        }
        Object.defineProperties(this, {
            id: { value: normalizedId, enumerable: true }, sequence: { value: sequence, enumerable: true },
            sourceId: { value: normalizedSource, enumerable: true }, notes: { value: Object.freeze([...notes]), enumerable: true },
            simultaneous: { value: simultaneous, enumerable: true }, role: { value: role === null ? null : String(role), enumerable: true },
            scaleDegree: { value: scaleDegree, enumerable: true }, chordMembers: { value: Object.freeze([...chordMembers]), enumerable: true },
            metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true },
            writtenPitches: { value: Object.freeze(notes.map(String)), enumerable: true }
        });
        Object.freeze(this);
    }
}

export default ExerciseStep;
