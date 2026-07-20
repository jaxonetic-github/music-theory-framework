import { ValidationError } from "../../Foundation/index.js";
import { Note, PitchClass } from "../../Theory/index.js";
import { ExerciseModel } from "../ExerciseModel.js";
import { ExerciseRow } from "../ExerciseRow.js";
import { ExerciseSection } from "../ExerciseSection.js";
import { ExerciseStep } from "../ExerciseStep.js";
import { identityToken } from "../identity.js";
import { ExerciseStrategy } from "./ExerciseStrategy.js";
import { chordMemberRoles } from "../advanced/chordMemberRoles.js";

const letters = Object.freeze(["C", "D", "E", "F", "G", "A", "B"]);
const natural = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
const targetRoles = Object.freeze({ root: 1, third: 3, fifth: 5, seventh: 7 });
const modulo = value => ((value % 12) + 12) % 12;

function noteAt(pitchClass, midi) {
    for (let octave = -1; octave <= 9; octave += 1) {
        try { const note = new Note(pitchClass, octave); if (note.midi === midi) return note; } catch {}
    }
    throw new ValidationError(`Written pitch ${pitchClass} cannot represent MIDI ${midi} exactly.`);
}
function spell(letter, semitones) {
    let difference = modulo(modulo(semitones) - natural[letter] + 6) - 6;
    if (difference < -2 || difference > 2) throw new ValidationError(`Pitch ${letter} cannot express the required sounding pitch without unsupported spelling.`);
    return PitchClass.from(`${letter}${difference > 0 ? "#".repeat(difference) : "b".repeat(-difference)}`);
}
function roleSpelling(root, semitones, letterOffset) {
    const index = letters.indexOf(String(root)[0]);
    return spell(letters[(index + letterOffset) % 7], semitones);
}
function chordTargets(request, chord) {
    const roles = chordMemberRoles(chord.pattern);
    const requested = String(request.target);
    if (requested === "all") return roles.map((role, index) => ({ role, index }));
    const role = targetRoles[requested], index = roles.indexOf(role);
    if (index < 0) throw new ValidationError(`Chord quality "${request.quality}" does not provide target ${requested}.`);
    return [{ role, index }];
}
function directionalNote(pitchClass, targetMidi, direction) {
    let midi = modulo(pitchClass.semitones - modulo(targetMidi)) + targetMidi;
    if (direction === "below") { if (midi >= targetMidi) midi -= 12; }
    else if (midi <= targetMidi) midi += 12;
    return noteAt(pitchClass, midi);
}
function chromaticNeighbor(target, direction) {
    const targetLetter = letters.indexOf(String(target.pitchClass)[0]);
    const offset = direction === "below" ? -1 : 1;
    const letter = letters[targetLetter];
    return directionalNote(spell(letter, target.midi + offset), target.midi, direction);
}
function diatonicNeighbor(root, scale, role, target, direction) {
    const degreeIndex = role - 1 + (direction === "below" ? -1 : 1);
    const member = (degreeIndex + 70) % 7;
    const pitch = roleSpelling(root, root.semitones + scale.pattern.intervals[member], member);
    return directionalNote(pitch, target.midi, direction);
}
function targetNote(root, chord, target, startingOctave) {
    const tonic = new Note(root, startingOctave);
    const pitch = target.index === 0 ? root : roleSpelling(root, chord.pitchClasses[target.index].semitones, target.role - 1);
    return noteAt(pitch, tonic.midi + chord.pattern.intervals[target.index]);
}
function neighbor(kind, direction, context) {
    return kind === "chromatic" ? chromaticNeighbor(context.target, direction)
        : diatonicNeighbor(context.root, context.scale, context.role, context.target, direction);
}
function patternParts(value) {
    const tokens = String(value).split("-");
    if (tokens.length === 2) return [{ kind: tokens[0], direction: tokens[1] }];
    if (tokens.length === 3) return [{ kind: tokens[0], direction: tokens[1] }, { kind: tokens[0], direction: tokens[2] }];
    return [{ kind: tokens[0], direction: tokens[1] }, { kind: tokens[2], direction: tokens[3] }];
}

export class AdvancedExerciseStrategy extends ExerciseStrategy {
    constructor({ scaleGenerator, chordGenerator, progressionCatalog } = {}) {
        super({ id: "advanced", pluginId: "core.exercise.advanced" });
        if (!scaleGenerator?.generate || !chordGenerator?.generate || !progressionCatalog?.get) throw new ValidationError("AdvancedExerciseStrategy requires active scale, chord, and progression services.");
        Object.defineProperties(this, { scaleGenerator: { value: scaleGenerator }, chordGenerator: { value: chordGenerator }, progressionCatalog: { value: progressionCatalog } });
        Object.freeze(this);
    }
    supports(request) { return ["approach-note", "enclosure", "chord-progression"].includes(String(request.type)); }
    generate(request) {
        const rows = request.roots.map((root, index) => String(request.type) === "chord-progression"
            ? this.#progressionRow(request, root, index + 1) : this.#targetRow(request, root, index + 1));
        const sectionId = `${request.identity}:section:1`;
        return new ExerciseModel({ id: request.identity, request, sections: [new ExerciseSection({ id: sectionId, title: `${String(request.type)} exercises`, sequence: 1, rows, metadata: { rootOrder: request.roots.map(String) } })], metadata: { pluginId: String(this.pluginId), strategyId: String(this.id), semantic: true } });
    }
    #targetRow(request, root, position) {
        const chord = this.chordGenerator.generate(root, request.quality);
        const scale = this.scaleGenerator.generate(root, "major");
        const targets = chordTargets(request, chord);
        const rowId = `${request.identity}:row:${position}:${identityToken(root)}`;
        const pattern = String(request.approachPattern ?? request.enclosurePattern);
        const parts = patternParts(pattern);
        const steps = targets.map((target, index) => {
            const resolved = targetNote(root, chord, target, request.startingOctave);
            const context = { root, scale, role: target.role, target: resolved };
            const surrounding = parts.map(part => neighbor(part.kind, part.direction, context));
            const notes = [...surrounding, resolved];
            const eventRoles = [...parts.map(part => Object.freeze({ role: String(request.type) === "approach-note" ? "approach" : "surrounding", direction: part.direction, classification: part.kind })), Object.freeze({ role: "target", chordMember: target.role, resolvesFrom: surrounding.length })];
            return new ExerciseStep({ id: `${rowId}:target:${target.role}`, sequence: index + 1, sourceId: `theory:chord:${root}:${request.quality}:member:${target.role}`, notes, simultaneous: false, role: String(request.type) === "approach-note" ? "approach-resolution" : "enclosure-resolution", metadata: { sourceChordId: `theory:chord:${root}:${request.quality}`, targetNoteId: `target:${root}:${request.quality}:${target.role}`, targetChordMember: target.role, pattern, eventRoles, resolutionTarget: String(resolved) } });
        });
        return new ExerciseRow({ id: rowId, title: `${root} ${request.quality} ${String(request.type)}`, subtitle: pattern, root, quality: request.quality, direction: request.direction, octaves: 1, startingOctave: request.startingOctave, type: request.type, steps, metadata: { rootPosition: position, target: String(request.target), pattern, sourceChordQuality: request.quality } });
    }
    #progressionRow(request, root, position) {
        const definition = this.progressionCatalog.get(request.progression, { required: true });
        const scalePattern = definition.mode === "major" ? "major" : "natural-minor";
        const scale = this.scaleGenerator.generate(root, scalePattern);
        const tonic = new Note(root, request.startingOctave);
        const rowId = `${request.identity}:row:${position}:${identityToken(root)}`;
        const steps = definition.events.map(event => {
            const degreeIndex = event.degree - 1;
            const eventRoot = degreeIndex === 0 ? root : roleSpelling(root, root.semitones + scale.pattern.intervals[degreeIndex], degreeIndex);
            const rootMidi = tonic.midi + scale.pattern.intervals[degreeIndex];
            const chord = this.chordGenerator.generate(eventRoot, event.quality);
            const roles = chordMemberRoles(chord.pattern);
            const notes = chord.pattern.intervals.map((interval, index) => noteAt(index === 0 ? eventRoot : roleSpelling(eventRoot, chord.pitchClasses[index].semitones, roles[index] - 1), rootMidi + interval));
            return new ExerciseStep({ id: `${rowId}:progression:${event.position}`, sequence: event.position, sourceId: `${definition.id}:${event.id}:${root}`, notes, simultaneous: true, role: "harmonic-event", scaleDegree: event.degree, chordMembers: roles, metadata: { progressionId: String(definition.id), harmonicEventId: event.id, position: event.position, romanNumeral: event.romanNumeral, harmonicFunction: event.function, chordQuality: event.quality, sourceKey: String(root), sourceMode: definition.mode, writtenRoot: String(eventRoot), writtenChordNotes: notes.map(String), voicing: "root-position-close" } });
        });
        return new ExerciseRow({ id: rowId, title: `${root} ${definition.name}`, subtitle: definition.mode, root, pattern: String(definition.id), direction: request.direction, octaves: 1, startingOctave: request.startingOctave, type: request.type, steps, metadata: { rootPosition: position, progressionId: String(definition.id), progressionMode: definition.mode, voicing: "root-position-close" } });
    }
}

export default AdvancedExerciseStrategy;
