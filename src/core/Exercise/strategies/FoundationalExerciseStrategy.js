import { ValidationError } from "../../Foundation/index.js";
import { ChordGenerator, Note, PitchClass, ScaleGenerator } from "../../Theory/index.js";
import { ExerciseModel } from "../ExerciseModel.js";
import { ExerciseRow } from "../ExerciseRow.js";
import { ExerciseSection } from "../ExerciseSection.js";
import { ExerciseStep } from "../ExerciseStep.js";
import { identityToken } from "../identity.js";
import { ExerciseStrategy } from "./ExerciseStrategy.js";

function noteAt(pitchClass, midi) {
    if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new ValidationError(`Exercise note is outside the MIDI range: ${pitchClass} at MIDI ${midi}.`);
    for (let octave = -1; octave <= 9; octave += 1) {
        try { const note = new Note(pitchClass, octave); if (note.midi === midi) return note; } catch {}
    }
    throw new ValidationError(`Exercise spelling ${pitchClass} cannot represent MIDI ${midi} without clamping or respelling.`);
}

const letters = Object.freeze(["C", "D", "E", "F", "G", "A", "B"]);
const naturalSemitones = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
function roleSpelling(root, target, letterOffset) {
    const rootLetter = String(root)[0];
    const letter = letters[(letters.indexOf(rootLetter) + letterOffset) % letters.length];
    let difference = ((PitchClass.from(target).semitones - naturalSemitones[letter] + 6) % 12) - 6;
    if (difference < -2 || difference > 2) return PitchClass.from(target);
    return PitchClass.from(`${letter}${difference > 0 ? "#".repeat(difference) : "b".repeat(-difference)}`);
}

function chordRoles(model) {
    if (model.pattern.intervals.length === 4) return [1, 3, 5, 7];
    const middle = model.pattern.intervals[1] === 2 ? 2 : model.pattern.intervals[1] === 5 ? 4 : 3;
    return [1, middle, 5];
}

function orient(configs, direction, { reverseNotes = false, shareApex = true } = {}) {
    const descending = [...configs].reverse().map(config => reverseNotes ? { ...config, notes: [...config.notes].reverse(), members: [...config.members].reverse() } : config);
    if (String(direction) === "ascending") return configs;
    if (String(direction) === "descending") return descending;
    return [...configs, ...descending.slice(shareApex ? 1 : 0)];
}

function stepValues(configs, rowId) {
    return configs.map((config, index) => new ExerciseStep({
        id: `${rowId}:step:${index + 1}`, sequence: index + 1, sourceId: config.sourceId,
        notes: config.notes, simultaneous: config.simultaneous ?? false, role: config.role ?? null,
        scaleDegree: config.degree ?? null, chordMembers: config.members ?? [], metadata: config.metadata ?? {}
    }));
}

function scaleNote(model, root, tonicMidi, index) {
    const count = model.pattern.intervals.length;
    const member = ((index % count) + count) % count;
    const cycle = Math.floor(index / count);
    const spelling = member === 0 ? root : model.pitchClasses.length === 7
        ? roleSpelling(root, model.pitchClasses[member], member) : model.pitchClasses[member];
    return noteAt(spelling, tonicMidi + model.pattern.intervals[member] + cycle * 12);
}

function chordNote(model, root, tonicMidi, member, cycle = 0) {
    const roles = chordRoles(model);
    const spelling = member === 0 ? root : roleSpelling(root, model.pitchClasses[member], roles[member] - 1);
    return noteAt(spelling, tonicMidi + model.pattern.intervals[member] + cycle * 12);
}

export class FoundationalExerciseStrategy extends ExerciseStrategy {
    constructor({ scaleGenerator = new ScaleGenerator(), chordGenerator = new ChordGenerator() } = {}) {
        super({ id: "foundational", pluginId: "core.exercise.foundational" });
        if (!scaleGenerator || typeof scaleGenerator.generate !== "function") throw new ValidationError("Foundational exercise strategy requires a scale generator.");
        if (!chordGenerator || typeof chordGenerator.generate !== "function") throw new ValidationError("Foundational exercise strategy requires a chord generator.");
        Object.defineProperties(this, { scaleGenerator: { value: scaleGenerator }, chordGenerator: { value: chordGenerator } });
        Object.freeze(this);
    }
    supports(request) { return !["approach-note", "enclosure", "chord-progression"].includes(String(request.type)); }

    generate(request) {
        const rows = request.roots.map((root, index) => this.#row(request, root, index + 1));
        const sectionId = `${request.identity}:section:1`;
        return new ExerciseModel({
            id: request.identity, request,
            sections: [new ExerciseSection({ id: sectionId, title: `${String(request.type)} exercises`, sequence: 1, rows, metadata: { rootOrder: request.roots.map(String) } })],
            metadata: { pluginId: String(this.pluginId), strategyId: String(this.id), semantic: true }
        });
    }

    #row(request, root, position) {
        const family = String(request.type);
        const rootToken = identityToken(root);
        const rowId = `${request.identity}:row:${position}:${rootToken}`;
        let generated;
        let configs;
        if (family === "scale" || family === "scale-thirds") {
            generated = this.scaleGenerator.generate(root, request.pattern);
            configs = family === "scale" ? this.#scale(request, root, generated) : this.#thirds(request, root, generated);
        } else {
            generated = this.chordGenerator.generate(root, request.quality);
            configs = family.startsWith("arpeggio-") ? this.#arpeggio(request, root, generated)
                : this.#chord(request, root, generated);
        }
        return new ExerciseRow({
            id: rowId, title: `${root} ${request.pattern ?? request.quality}`, subtitle: String(request.type), root,
            pattern: request.pattern, quality: request.quality, direction: request.direction, octaves: request.octaves,
            startingOctave: request.startingOctave, type: request.type, steps: stepValues(configs, rowId),
            metadata: { rootPosition: position, theoryIntervals: generated.pattern.intervals, theoryPatternName: generated.pattern.name }
        });
    }

    #scale(request, root, model) {
        const tonic = new Note(root, request.startingOctave);
        const count = model.pattern.intervals.length;
        const ascending = Array.from({ length: count * request.octaves + 1 }, (_, index) => ({
            notes: [scaleNote(model, root, tonic.midi, index)], degree: index % count + 1,
            role: "scale-degree", sourceId: `theory:scale:${root}:${request.pattern}:degree:${index % count + 1}:cycle:${Math.floor(index / count)}`,
            metadata: { registerIndex: index }
        }));
        return orient(ascending, request.direction);
    }

    #thirds(request, root, model) {
        const tonic = new Note(root, request.startingOctave);
        const count = model.pattern.intervals.length;
        const ascending = Array.from({ length: count * request.octaves }, (_, index) => ({
            notes: [scaleNote(model, root, tonic.midi, index), scaleNote(model, root, tonic.midi, index + 2)],
            degree: index % count + 1, role: "diatonic-third", members: [],
            sourceId: `theory:scale:${root}:${request.pattern}:third:${index % count + 1}:cycle:${Math.floor(index / count)}`,
            metadata: { endpointWrap: index + 2 >= count * request.octaves }
        }));
        return orient(ascending, request.direction, { reverseNotes: true });
    }

    #arpeggio(request, root, model) {
        const expected = String(request.type) === "arpeggio-triad" ? 3 : 4;
        if (model.pattern.intervals.length !== expected) throw new ValidationError(`Chord quality "${request.quality}" is incompatible with a ${expected === 3 ? "triad" : "seventh-chord"} arpeggio.`);
        const roles = chordRoles(model);
        if (expected === 3 && roles.join(",") !== "1,3,5") throw new ValidationError(`Chord quality "${request.quality}" does not contain triad members 1–3–5.`);
        const tonic = new Note(root, request.startingOctave);
        const ascending = Array.from({ length: expected * request.octaves + 1 }, (_, index) => {
            const member = index % expected;
            const cycle = Math.floor(index / expected);
            return { notes: [chordNote(model, root, tonic.midi, member, cycle)], members: [roles[member]], role: "chord-member",
                sourceId: `theory:chord:${root}:${request.quality}:member:${roles[member]}:cycle:${cycle}`, metadata: { registerIndex: index } };
        });
        return orient(ascending, request.direction);
    }

    #chord(request, root, model) {
        const tonic = new Note(root, request.startingOctave);
        const members = chordRoles(model);
        if (String(request.type) === "chord-blocked") {
            const ascending = Array.from({ length: request.octaves }, (_, cycle) => ({
                notes: members.map((member, index) => chordNote(model, root, tonic.midi, index, cycle)), members,
                simultaneous: true, role: "blocked-chord", sourceId: `theory:chord:${root}:${request.quality}:block:cycle:${cycle}`
            }));
            return orient(ascending, request.direction);
        }
        const ascending = Array.from({ length: members.length * request.octaves + 1 }, (_, index) => {
            const member = index % members.length;
            const cycle = Math.floor(index / members.length);
            return { notes: [chordNote(model, root, tonic.midi, member, cycle)], members: [members[member]], role: "broken-chord-member",
                sourceId: `theory:chord:${root}:${request.quality}:broken:${members[member]}:cycle:${cycle}` };
        });
        return orient(ascending, request.direction);
    }
}

export default FoundationalExerciseStrategy;
