import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

const namedIntervals = Object.freeze({
    P1: 0, m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, A4: 6, d5: 6,
    P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12
});
const canonicalNames = Object.freeze(["P1", "m2", "M2", "m3", "M3", "P4", "A4", "P5", "m6", "M6", "m7", "M7", "P8"]);

export class Interval extends ImmutableValue {
    constructor(value = 0) {
        if (value instanceof Interval) return value;
        const semitones = typeof value === "string" ? namedIntervals[value] : Number(value);
        if (!Number.isInteger(semitones) || semitones < 0) throw new ValidationError(`Invalid interval: "${String(value)}".`);
        super({ semitones, name: canonicalNames[semitones] ?? `${semitones}st` });
    }

    static from(value) { return value instanceof Interval ? value : new Interval(value); }
    add(other) { return new Interval(this.semitones + Interval.from(other).semitones); }
    toString() { return this.name; }
    toJSON() { return this.semitones; }
}

export default Interval;
