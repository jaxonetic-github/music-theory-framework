import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

const naturalSemitones = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
const sharpNames = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
const flatNames = Object.freeze(["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]);

function modulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }

function parsePitchClass(value) {
    if (Number.isInteger(value)) return { semitones: modulo(value, 12), spelling: null };
    const normalized = String(value ?? "").trim().replaceAll("♯", "#").replaceAll("♭", "b");
    const match = /^([A-Ga-g])([#b]{0,2})$/.exec(normalized);
    if (!match) throw new ValidationError(`Invalid pitch class: "${String(value)}".`);
    const letter = match[1].toUpperCase();
    const accidental = match[2];
    const offset = [...accidental].reduce((total, token) => total + (token === "#" ? 1 : -1), 0);
    return { semitones: modulo(naturalSemitones[letter] + offset, 12), spelling: `${letter}${accidental}` };
}

export class PitchClass extends ImmutableValue {
    constructor(value, options = {}) {
        if (value instanceof PitchClass && options.prefer === undefined) return value;
        const parsed = value instanceof PitchClass
            ? { semitones: value.semitones, spelling: null }
            : parsePitchClass(value);
        const prefer = options.prefer ?? (parsed.spelling?.includes("b") ? "flats" : "sharps");
        if (!["sharps", "flats"].includes(prefer)) throw new ValidationError(`Unknown accidental preference: "${prefer}".`);
        super({
            semitones: parsed.semitones,
            spelling: parsed.spelling ?? (prefer === "flats" ? flatNames : sharpNames)[parsed.semitones],
            prefer
        });
    }

    static from(value, options) { return value instanceof PitchClass && !options ? value : new PitchClass(value, options); }
    transpose(semitones, options = {}) { return new PitchClass(this.semitones + Number(semitones), { prefer: options.prefer ?? this.prefer }); }
    enharmonicEquals(other) { return this.semitones === PitchClass.from(other).semitones; }
    toString() { return this.spelling; }
    toJSON() { return this.spelling; }
}

export default PitchClass;
