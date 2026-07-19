import { ImmutableValue, ValidationError } from "../../Foundation/index.js";
import { PitchClass } from "../../Theory/index.js";

const standardKeys = Object.freeze({
    major: Object.freeze({ C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 }),
    minor: Object.freeze({ A: 0, E: 1, B: 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6, "A#": 7, D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7 })
});

export class KeySignature extends ImmutableValue {
    constructor(value = { tonic: "C", mode: "major" }) {
        if (value instanceof KeySignature) return value;
        const source = typeof value === "string" ? { tonic: value, mode: "major" } : value ?? {};
        const tonic = PitchClass.from(source.tonic);
        const mode = String(source.mode ?? "").trim().toLowerCase();
        if (!Object.hasOwn(standardKeys, mode)) throw new ValidationError(`Unsupported key-signature mode: "${mode}".`);
        const expected = standardKeys[mode][String(tonic)];
        if (expected === undefined) throw new ValidationError(`Unsupported ${mode} key signature tonic: "${tonic}".`);
        const accidentals = Number(source.accidentals ?? expected);
        if (!Number.isInteger(accidentals) || accidentals < -7 || accidentals > 7) {
            throw new ValidationError("Key-signature accidentals must be an integer from -7 through 7.");
        }
        if (accidentals !== expected) {
            throw new ValidationError(`${tonic} ${mode} requires ${expected} key-signature accidentals, received ${accidentals}.`);
        }
        super({ tonic, mode, accidentals });
    }

    static from(value) { return value instanceof KeySignature ? value : new KeySignature(value); }
    get sharps() { return Math.max(0, this.accidentals); }
    get flats() { return Math.max(0, -this.accidentals); }
    toString() { return `${this.tonic} ${this.mode}`; }
}

export default KeySignature;
