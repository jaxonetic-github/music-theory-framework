import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

const defaults = Object.freeze({ treble: 2, bass: 4, alto: 3, tenor: 4, percussion: 3 });

export class Clef extends ImmutableValue {
    constructor(value = "treble") {
        if (value instanceof Clef) return value;
        const source = typeof value === "string" ? { type: value } : value ?? {};
        const type = String(source.type ?? "").trim().toLowerCase();
        if (!Object.hasOwn(defaults, type)) throw new ValidationError(`Unsupported clef: "${type}".`);
        const line = Number(source.line ?? defaults[type]);
        if (!Number.isInteger(line) || line < 1 || line > 5) throw new ValidationError("A clef line must be an integer from 1 through 5.");
        const octaveShift = Number(source.octaveShift ?? 0);
        if (!Number.isInteger(octaveShift) || octaveShift < -2 || octaveShift > 2) {
            throw new ValidationError("A clef octave shift must be an integer from -2 through 2.");
        }
        super({ type, line, octaveShift });
    }

    static from(value) { return value instanceof Clef ? value : new Clef(value); }
    toString() { return this.type; }
}

export default Clef;
