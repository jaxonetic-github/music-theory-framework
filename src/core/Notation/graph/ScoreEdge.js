import { ValidationError } from "../../Foundation/index.js";
import { TheoryEdge } from "../../Theory/index.js";

const scoreEdgeTypes = Object.freeze(["contains", "next"]);

export class ScoreEdge extends TheoryEdge {
    constructor(source = {}) {
        const type = String(source.type ?? "contains");
        if (!scoreEdgeTypes.includes(type)) throw new ValidationError(`Unsupported score edge type: "${type}".`);
        super({ ...source, type });
    }

    static from(value) { return value instanceof ScoreEdge ? value : new ScoreEdge(value); }
}

export function isScoreEdgeType(value) { return scoreEdgeTypes.includes(String(value)); }

export default ScoreEdge;
