import { ImmutableValue, ValidationError } from "../Foundation/index.js";

export const EXERCISE_TYPES = Object.freeze([
    "scale", "scale-thirds", "arpeggio-triad", "arpeggio-seventh", "chord-blocked", "chord-broken",
    "approach-note", "enclosure", "chord-progression"
]);

export class ExerciseType extends ImmutableValue {
    constructor(value) {
        if (value instanceof ExerciseType) return value;
        const normalized = String(value ?? "").trim().toLowerCase();
        if (!EXERCISE_TYPES.includes(normalized)) throw new ValidationError(`Unknown exercise family: "${String(value)}".`);
        super({ value: normalized });
    }
    static from(value) { return value instanceof ExerciseType ? value : new ExerciseType(value); }
    toString() { return this.value; }
    toJSON() { return this.value; }
}

export default ExerciseType;
