import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

export const ENCLOSURE_PATTERNS = Object.freeze([
    "chromatic-above-below", "chromatic-below-above", "diatonic-above-below", "diatonic-below-above",
    "diatonic-above-chromatic-below", "chromatic-below-diatonic-above"
]);
export class EnclosurePattern extends ImmutableValue {
    constructor(value = "chromatic-above-below") {
        if (value instanceof EnclosurePattern) return value;
        const normalized = String(value).trim().toLowerCase();
        if (!ENCLOSURE_PATTERNS.includes(normalized)) throw new ValidationError(`Unknown enclosure pattern: "${normalized}".`);
        super({ value: normalized });
    }
    static from(value) { return value instanceof EnclosurePattern ? value : new EnclosurePattern(value); }
    toString() { return this.value; }
    toJSON() { return this.value; }
}
