import { ImmutableValue, ValidationError } from "../../Foundation/index.js";
import { PitchClass } from "./PitchClass.js";

function noteParts(value, octave) {
    if (value instanceof Note) return { pitchClass: value.pitchClass, octave: value.octave };
    if (octave !== undefined) return { pitchClass: PitchClass.from(value), octave: Number(octave) };
    const match = /^(.+?)(-?\d+)$/.exec(String(value ?? "").trim());
    if (!match) throw new ValidationError(`Invalid note: "${String(value)}".`);
    return { pitchClass: PitchClass.from(match[1]), octave: Number(match[2]) };
}

export class Note extends ImmutableValue {
    constructor(value, octave) {
        if (value instanceof Note && octave === undefined) return value;
        const parts = noteParts(value, octave);
        if (!Number.isInteger(parts.octave)) throw new ValidationError("A note octave must be an integer.");
        const midi = (parts.octave + 1) * 12 + parts.pitchClass.semitones;
        if (midi < 0 || midi > 127) throw new ValidationError(`Note is outside the MIDI range: ${parts.pitchClass}${parts.octave}.`);
        super({ pitchClass: parts.pitchClass, octave: parts.octave, midi });
    }

    static from(value, octave) { return value instanceof Note && octave === undefined ? value : new Note(value, octave); }
    static fromMidi(midi, options = {}) {
        if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new ValidationError(`Invalid MIDI note: "${midi}".`);
        return new Note(new PitchClass(midi, options), Math.floor(midi / 12) - 1);
    }
    transpose(interval, options = {}) { return Note.fromMidi(this.midi + Number(interval?.semitones ?? interval), { prefer: options.prefer ?? this.pitchClass.prefer }); }
    frequency(reference = 440) { return Number(reference) * 2 ** ((this.midi - 69) / 12); }
    toString() { return `${this.pitchClass}${this.octave}`; }
    toJSON() { return this.toString(); }
}

export default Note;
