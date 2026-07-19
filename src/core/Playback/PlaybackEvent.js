import { Note } from "../Theory/index.js";
import { ValidationError } from "../Foundation/index.js";

function id(value, label) {
    const normalized = String(value ?? "").trim();
    if (!normalized) throw new ValidationError(`${label} must be a non-empty identifier.`);
    return normalized;
}

function safeInteger(value, label, minimum = 0) {
    const normalized = Number(value);
    if (!Number.isSafeInteger(normalized) || normalized < minimum) {
        throw new ValidationError(`${label} must be a safe integer of at least ${minimum}.`);
    }
    return normalized;
}

export class PlaybackEvent {
    constructor({
        sequence, note, startTick, durationTicks, velocity = 96,
        partId, measureId, measureNumber, voiceId, voiceIndex,
        sourceEventId, chordId = null, chordIndex = null
    } = {}) {
        const normalizedNote = Note.from(note);
        const normalizedChordId = chordId === null ? null : id(chordId, "Chord id");
        const normalizedChordIndex = chordIndex === null ? null : safeInteger(chordIndex, "Chord index", 0);
        if ((normalizedChordId === null) !== (normalizedChordIndex === null)) {
            throw new ValidationError("Chord id and chord index must either both be present or both be null.");
        }
        Object.defineProperties(this, {
            sequence: { value: safeInteger(sequence, "Playback sequence", 1), enumerable: true },
            note: { value: normalizedNote, enumerable: true },
            writtenPitch: { value: normalizedNote.toString(), enumerable: true },
            midi: { value: normalizedNote.midi, enumerable: true },
            startTick: { value: safeInteger(startTick, "Playback start tick"), enumerable: true },
            durationTicks: { value: safeInteger(durationTicks, "Playback duration ticks", 1), enumerable: true },
            velocity: { value: safeInteger(velocity, "Playback velocity", 1), enumerable: true },
            partId: { value: id(partId, "Part id"), enumerable: true },
            measureId: { value: id(measureId, "Measure id"), enumerable: true },
            measureNumber: { value: safeInteger(measureNumber, "Measure number", 1), enumerable: true },
            voiceId: { value: id(voiceId, "Voice id"), enumerable: true },
            voiceIndex: { value: safeInteger(voiceIndex, "Voice index", 1), enumerable: true },
            sourceEventId: { value: id(sourceEventId, "Source event id"), enumerable: true },
            chordId: { value: normalizedChordId, enumerable: true },
            chordIndex: { value: normalizedChordIndex, enumerable: true }
        });
        if (this.velocity > 127) throw new ValidationError("Playback velocity must not exceed 127.");
        if (!Number.isSafeInteger(this.startTick + this.durationTicks)) {
            throw new ValidationError("Playback event end tick exceeds the safe integer range.");
        }
        Object.freeze(this);
    }

    get endTick() { return this.startTick + this.durationTicks; }
}

export default PlaybackEvent;
