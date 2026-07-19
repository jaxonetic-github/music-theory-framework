import { Identifier, ImmutableValue, ValidationError } from "../../Foundation/index.js";

export class ChordPattern extends ImmutableValue {
    constructor({ id, name, intervals, symbol = "" } = {}) {
        if (id instanceof ChordPattern) return id;
        const normalized = [...(intervals ?? [])].map(Number);
        if (normalized.length < 2 || normalized[0] !== 0 || normalized.some((value, index) =>
            !Number.isInteger(value) || value < 0 || (index > 0 && value <= normalized[index - 1]))) {
            throw new ValidationError("Chord intervals must be unique ascending non-negative semitones beginning with 0.");
        }
        super({ id: Identifier.from(id), name: String(name ?? id), symbol: String(symbol), intervals: Object.freeze(normalized) });
    }

    static from(value) { return value instanceof ChordPattern ? value : new ChordPattern(value); }
    toString() { return String(this.id); }
}

export default ChordPattern;
