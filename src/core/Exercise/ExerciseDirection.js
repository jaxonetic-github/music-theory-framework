import { ImmutableValue, ValidationError } from "../Foundation/index.js";

export const EXERCISE_DIRECTIONS = Object.freeze(["ascending", "descending", "ascending-descending"]);

export class ExerciseDirection extends ImmutableValue {
    constructor(value = "ascending") {
        if (value instanceof ExerciseDirection) return value;
        const normalized = String(value ?? "").trim().toLowerCase();
        if (!EXERCISE_DIRECTIONS.includes(normalized)) throw new ValidationError(`Unknown exercise direction: "${String(value)}".`);
        super({ value: normalized });
    }
    static from(value) { return value instanceof ExerciseDirection ? value : new ExerciseDirection(value); }
    toString() { return this.value; }
    toJSON() { return this.value; }
}

export default ExerciseDirection;
