import { ValidationError } from "../../Foundation/index.js";
import { TheoryNode } from "../../Theory/index.js";
import { Note } from "../../Theory/index.js";
import { Duration } from "../values/index.js";

const scoreNodeTypes = Object.freeze(["score", "part", "measure", "voice", "note", "chord"]);

function properties(source) {
    if (source?.value && source?.type) return { id: source.id, ...source.value };
    return source ?? {};
}

export class ScoreNode extends TheoryNode {
    static from(value) {
        if (value instanceof ScoreNode) return value;
        switch (String(value?.type ?? "")) {
            case "score": return new ScoreRootNode(value);
            case "part": return new PartNode(value);
            case "measure": return new MeasureNode(value);
            case "voice": return new VoiceNode(value);
            case "note": return new NoteNode(value);
            case "chord": return new ChordNode(value);
            default: throw new ValidationError(`Unsupported score node type: "${String(value?.type)}".`);
        }
    }
}

export class ScoreRootNode extends ScoreNode {
    constructor(source = {}) {
        const data = properties(source);
        super({ id: data.id ?? "score", type: "score", value: { title: String(data.title ?? "Untitled Score") }, metadata: source.metadata });
    }
    get title() { return this.value.title; }
}

export class PartNode extends ScoreNode {
    constructor(source = {}) {
        const data = properties(source);
        super({ id: data.id, type: "part", value: { name: String(data.name ?? "Part"), instrument: String(data.instrument ?? "piano") }, metadata: source.metadata });
    }
    get name() { return this.value.name; }
    get instrument() { return this.value.instrument; }
}

export class MeasureNode extends ScoreNode {
    constructor(source = {}) {
        const data = properties(source);
        const number = Number(data.number);
        if (!Number.isInteger(number) || number < 1) throw new ValidationError("A measure number must be a positive integer.");
        const beats = Number(data.beats ?? 4);
        const beatUnit = Number(data.beatUnit ?? 4);
        if (!Number.isInteger(beats) || beats < 1 || !Number.isInteger(beatUnit) || beatUnit < 1) {
            throw new ValidationError("A measure requires positive integer time-signature values.");
        }
        super({ id: data.id, type: "measure", value: { number, beats, beatUnit }, metadata: source.metadata });
    }
    get number() { return this.value.number; }
}

export class VoiceNode extends ScoreNode {
    constructor(source = {}) {
        const data = properties(source);
        const index = Number(data.index ?? 1);
        if (!Number.isInteger(index) || index < 1) throw new ValidationError("A voice index must be a positive integer.");
        super({ id: data.id, type: "voice", value: { index }, metadata: source.metadata });
    }
    get index() { return this.value.index; }
}

export class NoteNode extends ScoreNode {
    constructor(source = {}) {
        const data = properties(source);
        const offset = Number(data.offset ?? 0);
        if (!Number.isFinite(offset) || offset < 0) throw new ValidationError("A note offset must be non-negative.");
        super({
            id: data.id,
            type: "note",
            value: { pitch: Note.from(data.pitch), duration: Duration.from(data.duration), offset },
            metadata: source.metadata
        });
    }
    get pitch() { return this.value.pitch; }
    get duration() { return this.value.duration; }
    get offset() { return this.value.offset; }
}

export class ChordNode extends ScoreNode {
    constructor(source = {}) {
        const data = properties(source);
        const notes = [...(data.notes ?? [])].map(note => Note.from(note));
        if (notes.length < 2) throw new ValidationError("A score chord requires at least two notes.");
        const offset = Number(data.offset ?? 0);
        if (!Number.isFinite(offset) || offset < 0) throw new ValidationError("A chord offset must be non-negative.");
        super({
            id: data.id,
            type: "chord",
            value: { notes: Object.freeze(notes), duration: Duration.from(data.duration), offset },
            metadata: source.metadata
        });
    }
    get notes() { return this.value.notes; }
    get duration() { return this.value.duration; }
    get offset() { return this.value.offset; }
}

export function isScoreNodeType(value) { return scoreNodeTypes.includes(String(value)); }

export default ScoreNode;
