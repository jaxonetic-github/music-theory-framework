import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

export const CHORD_TARGETS = Object.freeze(["root", "third", "fifth", "seventh", "all"]);
export class ChordTarget extends ImmutableValue {
    constructor(value = "all") {
        if (value instanceof ChordTarget) return value;
        const normalized = String(value).trim().toLowerCase();
        if (!CHORD_TARGETS.includes(normalized)) throw new ValidationError(`Unknown chord target: "${normalized}".`);
        super({ value: normalized });
    }
    static from(value) { return value instanceof ChordTarget ? value : new ChordTarget(value); }
    toString() { return this.value; }
    toJSON() { return this.value; }
}
