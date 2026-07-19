import { ValidationError } from "../../Foundation/index.js";
import { TheoryGraph } from "../../Theory/index.js";
import { ScoreEdge } from "./ScoreEdge.js";
import { ScoreNode } from "./ScoreNode.js";

const containment = Object.freeze({
    score: new Set(["part"]),
    part: new Set(["measure"]),
    measure: new Set(["voice"]),
    voice: new Set(["note", "chord"])
});
const eventTypes = new Set(["note", "chord"]);

export class ScoreGraph extends TheoryGraph {
    constructor({ nodes = [], edges = [] } = {}) {
        if (nodes instanceof ScoreGraph) return nodes;
        const normalizedNodes = [...nodes].map(node => ScoreNode.from(node));
        const normalizedEdges = [...edges].map(edge => ScoreEdge.from(edge));
        const nodeById = new Map(normalizedNodes.map(node => [String(node.id), node]));
        const scores = normalizedNodes.filter(node => String(node.type) === "score");
        if (scores.length !== 1) throw new ValidationError("A score graph must contain exactly one score node.");

        const parents = new Map();
        const sequential = [];
        for (const edge of normalizedEdges) {
            const from = nodeById.get(String(edge.from));
            const to = nodeById.get(String(edge.to));
            if (!from || !to) continue;
            if (String(edge.type) === "contains") {
                if (!containment[String(from.type)]?.has(String(to.type))) {
                    throw new ValidationError(`Invalid score containment: ${from.type} cannot contain ${to.type}.`);
                }
                const childId = String(to.id);
                if (parents.has(childId)) throw new ValidationError(`Score node "${childId}" has multiple parents.`);
                parents.set(childId, String(from.id));
            } else if (!eventTypes.has(String(from.type)) || !eventTypes.has(String(to.type))) {
                throw new ValidationError("Sequential score edges must connect note or chord events.");
            } else sequential.push(edge);
        }
        for (const node of normalizedNodes) {
            if (String(node.type) !== "score" && !parents.has(String(node.id))) {
                throw new ValidationError(`Score node "${String(node.id)}" is not contained by the score hierarchy.`);
            }
        }
        const successors = new Map();
        const predecessors = new Set();
        for (const edge of sequential) {
            const from = String(edge.from);
            const to = String(edge.to);
            if (parents.get(from) !== parents.get(to)) throw new ValidationError("Sequential score edges must connect events in the same voice.");
            if (successors.has(from)) throw new ValidationError(`Score event "${from}" has multiple successors.`);
            if (predecessors.has(to)) throw new ValidationError(`Score event "${to}" has multiple predecessors.`);
            successors.set(from, to);
            predecessors.add(to);
        }
        for (const start of successors.keys()) {
            const visited = new Set();
            let current = start;
            while (successors.has(current)) {
                if (visited.has(current)) throw new ValidationError("Sequential score edges must not contain a cycle.");
                visited.add(current);
                current = successors.get(current);
            }
        }
        super({ nodes: normalizedNodes, edges: normalizedEdges });
    }

    static from(value) { return value instanceof ScoreGraph ? value : new ScoreGraph(value); }
    get score() { return this.nodes.find(node => String(node.type) === "score"); }
    nodesOfType(type) { return Object.freeze(this.nodes.filter(node => String(node.type) === String(type))); }
}

export default ScoreGraph;
