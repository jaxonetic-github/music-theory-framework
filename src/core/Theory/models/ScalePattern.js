import { Identifier, ImmutableValue, ValidationError } from "../../Foundation/index.js";

export class ScalePattern extends ImmutableValue {
    constructor({ id, name, intervals } = {}) {
        if (id instanceof ScalePattern) return id;
        const normalized = [...(intervals ?? [])].map(Number);
        if (normalized.length < 2 || normalized[0] !== 0 || normalized.some((value, index) =>
            !Number.isInteger(value) || value < 0 || value > 11 || (index > 0 && value <= normalized[index - 1]))) {
            throw new ValidationError("Scale intervals must be unique ascending semitones from 0 through 11, beginning with 0.");
        }
        super({ id: Identifier.from(id), name: String(name ?? id), intervals: Object.freeze(normalized) });
    }

    static from(value) { return value instanceof ScalePattern ? value : new ScalePattern(value); }
    toString() { return String(this.id); }
}

export default ScalePattern;
