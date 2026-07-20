import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

export const APPROACH_PATTERNS = Object.freeze(["chromatic-below", "chromatic-above", "diatonic-below", "diatonic-above"]);
export class ApproachPattern extends ImmutableValue {
    constructor(value = "chromatic-below") {
        if (value instanceof ApproachPattern) return value;
        const normalized = String(value).trim().toLowerCase();
        if (!APPROACH_PATTERNS.includes(normalized)) throw new ValidationError(`Unknown approach-note pattern: "${normalized}".`);
        super({ value: normalized });
    }
    static from(value) { return value instanceof ApproachPattern ? value : new ApproachPattern(value); }
    toString() { return this.value; }
    toJSON() { return this.value; }
}
