import { Note, PitchClass } from "../../Theory/index.js";
import { ValidationError } from "../../Foundation/index.js";

function noteAtMidi(pitchClass, midi) {
    const approximateOctave = Math.floor(midi / 12) - 1;
    for (const octave of [approximateOctave, approximateOctave - 1, approximateOctave + 1]) {
        try {
            const note = new Note(pitchClass, octave);
            if (note.midi === midi) return note;
        } catch {}
    }
    throw new ValidationError(`Pitch spelling "${pitchClass}" cannot represent MIDI note ${midi}.`);
}

export function resolveNotationNotes(model, options = {}) {
    if (options.notes !== undefined) {
        const notes = [...options.notes].map(note => Note.from(note));
        if (notes.length !== model.pitchClasses.length) {
            throw new ValidationError("Source notes must match the generated model tone count.");
        }
        notes.forEach((note, index) => {
            if (!note.pitchClass.enharmonicEquals(model.pitchClasses[index])) {
                throw new ValidationError(`Source note ${index + 1} does not match the generated pitch class.`);
            }
        });
        return Object.freeze(notes);
    }

    const octave = Number(options.octave ?? 4);
    const tonic = new Note(model.root, octave);
    if (model.pitchClasses.length !== model.pattern.intervals.length) {
        throw new ValidationError("Generated pitch classes and pattern intervals must have equal lengths.");
    }
    return Object.freeze(model.pitchClasses.map((source, index) => {
        const pitchClass = PitchClass.from(source);
        const midi = tonic.midi + model.pattern.intervals[index];
        if (pitchClass.semitones !== ((midi % 12) + 12) % 12) {
            throw new ValidationError(`Pitch spelling "${pitchClass}" does not match interval ${model.pattern.intervals[index]}.`);
        }
        return noteAtMidi(pitchClass, midi);
    }));
}

export default resolveNotationNotes;
