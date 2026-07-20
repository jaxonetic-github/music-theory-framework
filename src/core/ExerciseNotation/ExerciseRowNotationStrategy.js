import { ValidationError } from "../Foundation/index.js";
import { ExerciseRow } from "../Exercise/index.js";
import { ChordNode, KeySignature, MeasureNode, NoteNode, NotationStrategy, PartNode, ScoreEdge, ScoreGraph, ScoreRootNode, VoiceNode } from "../Notation/index.js";

function sourceMetadata(modelId, sectionId, row, step, emittedIndex, member = null) {
    return { attributes: { modelId, sectionId, rowId: row.id, stepId: step.id, sourceId: step.sourceId, emittedIndex, role: step.role, scaleDegree: step.scaleDegree, chordMembers: [...step.chordMembers], chordMember: member } };
}
function keyFor(row, request) {
    if (request.keySignaturePolicy === "none") return null;
    if (request.keySignaturePolicy === "explicit") return request.keySignature;
    const mode = row.pattern === "major" ? "major" : row.pattern === "melodic-minor" ? "minor" : null;
    if (!mode) throw new ValidationError(`Cannot safely derive a key signature for exercise row "${row.id}".`);
    return new KeySignature({ tonic: row.root, mode });
}
function add(a, b) { return { n: a.n * b.d + b.n * a.d, d: a.d * b.d }; }
function compare(a, b) { const left = a.n * b.d, right = b.n * a.d; return left < right ? -1 : left > right ? 1 : 0; }

export class ExerciseRowNotationStrategy extends NotationStrategy {
    constructor() { super({ id: "exercise-row", pluginId: "core.exercise.notation", inputType: "exercise-row" }); }
    supports(value) { return value instanceof ExerciseRow; }
    notate(row, options = {}) {
        if (!(row instanceof ExerciseRow)) throw new ValidationError("Exercise row notation supports ExerciseRow inputs only.");
        const request = options.request;
        if (!request?.model || !request.duration || !request.timeSignature) throw new ValidationError("Exercise row notation requires a normalized ExerciseNotationRequest.");
        const sectionId = String(options.sectionId ?? ""); if (!sectionId) throw new ValidationError("Exercise row notation requires section identity.");
        const duration = { n: BigInt(request.duration.numerator), d: BigInt(request.duration.denominator) };
        const capacity = { n: BigInt(request.timeSignature.beats), d: BigInt(request.timeSignature.beatUnit) };
        if (compare(duration, capacity) > 0) throw new ValidationError("An exercise notation event cannot be longer than one measure.");
        const emitted = [];
        for (const step of row.steps) {
            if (step.simultaneous) {
                if (step.notes.length < 2) throw new ValidationError(`Malformed simultaneous step "${step.id}".`);
                emitted.push({ step, notes: step.notes, member: null, chord: true, emittedIndex: 1 });
            } else {
                if (step.notes.length < 1) throw new ValidationError(`Malformed sequential step "${step.id}".`);
                step.notes.forEach((note, index) => emitted.push({ step, notes: [note], member: step.chordMembers[index] ?? null, chord: false, emittedIndex: index + 1 }));
            }
        }
        if (!Number.isSafeInteger(emitted.length) || emitted.length < 1) throw new ValidationError("Exercise row event range is unsafe.");
        const measures = []; let current = []; let used = { n: 0n, d: 1n };
        for (const event of emitted) {
            const next = add(used, duration);
            if (compare(next, capacity) > 0) { measures.push(current); current = []; used = { n: 0n, d: 1n }; }
            current.push(event); used = add(used, duration);
        }
        measures.push(current);
        if (!Number.isSafeInteger(measures.length)) throw new ValidationError("Exercise notation measure range is unsafe.");
        const prefix = `exercise-notation:${request.model.id}:${sectionId}:${row.id}`;
        const hierarchyMetadata = { attributes: { modelId: request.model.id, sectionId, rowId: row.id } };
        const nodes = [new ScoreRootNode({ id: `${prefix}:score`, title: row.title, metadata: hierarchyMetadata }), new PartNode({ id: `${prefix}:part:1`, name: row.title, instrument: "exercise", clef: request.clef, metadata: hierarchyMetadata })];
        const edges = [new ScoreEdge({ from: `${prefix}:score`, to: `${prefix}:part:1`, type: "contains" })];
        const signature = keyFor(row, request); let sequence = 0, previous = null;
        measures.forEach((events, measureIndex) => {
            const measureId = `${prefix}:measure:${measureIndex + 1}`, voiceId = `${measureId}:voice:1`;
            nodes.push(new MeasureNode({ id: measureId, number: measureIndex + 1, beats: request.timeSignature.beats, beatUnit: request.timeSignature.beatUnit, keySignature: signature, metadata: hierarchyMetadata }));
            nodes.push(new VoiceNode({ id: voiceId, index: 1, metadata: hierarchyMetadata }));
            edges.push(new ScoreEdge({ from: `${prefix}:part:1`, to: measureId, type: "contains" }), new ScoreEdge({ from: measureId, to: voiceId, type: "contains" }));
            events.forEach(event => {
                sequence += 1;
                if (!Number.isSafeInteger(sequence)) throw new ValidationError("Exercise notation event sequence is unsafe.");
                const id = `${prefix}:step:${event.step.id}:event:${event.emittedIndex}`;
                const metadata = sourceMetadata(request.model.id, sectionId, row, event.step, event.emittedIndex, event.member);
                if (event.chord) metadata.attributes.memberOrder = [...event.step.chordMembers];
                const node = event.chord ? new ChordNode({ id, notes: event.notes, duration: request.duration, offset: sequence, metadata }) : new NoteNode({ id, pitch: event.notes[0], duration: request.duration, offset: sequence, metadata });
                nodes.push(node); edges.push(new ScoreEdge({ from: voiceId, to: id, type: "contains" }));
                if (previous) edges.push(new ScoreEdge({ from: previous, to: id, type: "next" })); previous = id;
            });
        });
        return new ScoreGraph({ nodes, edges });
    }
}
