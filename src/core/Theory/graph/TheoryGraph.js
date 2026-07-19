import { ImmutableValue, TraversalOrder, ValidationError } from "../../Foundation/index.js";
import { TheoryEdge } from "./TheoryEdge.js";
import { TheoryNode } from "./TheoryNode.js";

const traversalOrders = new Set([TraversalOrder.BREADTH_FIRST, TraversalOrder.DEPTH_FIRST]);
const directions = new Set(["outgoing", "incoming", "both"]);

function neighborsFor(graph, id, direction) {
    const neighbors = [];
    for (const edge of graph.edges) {
        if (direction !== "incoming" && String(edge.from) === id) neighbors.push(String(edge.to));
        if (direction !== "outgoing" && String(edge.to) === id) neighbors.push(String(edge.from));
    }
    return [...new Set(neighbors)];
}

export class TheoryGraph extends ImmutableValue {
    constructor({ nodes = [], edges = [] } = {}) {
        if (nodes instanceof TheoryGraph) return nodes;
        const normalizedNodes = [...nodes].map(node => TheoryNode.from(node));
        const nodeIds = new Set();
        for (const node of normalizedNodes) {
            const id = String(node.id);
            if (nodeIds.has(id)) throw new ValidationError(`Duplicate theory node id: "${id}".`);
            nodeIds.add(id);
        }

        const normalizedEdges = [...edges].map(edge => TheoryEdge.from(edge));
        const edgeIds = new Set();
        for (const edge of normalizedEdges) {
            const id = String(edge.id);
            if (edgeIds.has(id)) throw new ValidationError(`Duplicate theory edge id: "${id}".`);
            edgeIds.add(id);
            if (!nodeIds.has(String(edge.from)) || !nodeIds.has(String(edge.to))) {
                throw new ValidationError(`Theory edge "${id}" references a missing node.`);
            }
        }
        super({ nodes: Object.freeze(normalizedNodes), edges: Object.freeze(normalizedEdges) });
    }

    static from(value) { return value instanceof TheoryGraph ? value : new TheoryGraph(value); }
    get size() { return this.nodes.length; }
    hasNode(id) { return this.nodes.some(node => String(node.id) === String(id)); }
    node(id) { return this.nodes.find(node => String(node.id) === String(id)) ?? null; }
    edgesFrom(id) { return Object.freeze(this.edges.filter(edge => String(edge.from) === String(id))); }
    edgesTo(id) { return Object.freeze(this.edges.filter(edge => String(edge.to) === String(id))); }

    traverse(start, options = {}) {
        const order = options.order ?? TraversalOrder.BREADTH_FIRST;
        const direction = options.direction ?? "outgoing";
        if (!traversalOrders.has(order)) throw new ValidationError(`Unsupported graph traversal order: "${order}".`);
        if (!directions.has(direction)) throw new ValidationError(`Unsupported graph traversal direction: "${direction}".`);
        if (start !== undefined && !this.hasNode(start)) throw new ValidationError(`Theory node "${String(start)}" was not found.`);

        const visited = new Set();
        const result = [];
        const roots = start === undefined ? this.nodes.map(node => String(node.id)) : [String(start)];
        for (const root of roots) {
            if (visited.has(root)) continue;
            const pending = [root];
            while (pending.length) {
                const id = order === TraversalOrder.BREADTH_FIRST ? pending.shift() : pending.pop();
                if (visited.has(id)) continue;
                visited.add(id);
                result.push(this.node(id));
                const neighbors = neighborsFor(this, id, direction).filter(candidate => !visited.has(candidate));
                if (order === TraversalOrder.DEPTH_FIRST) neighbors.reverse();
                pending.push(...neighbors);
            }
        }
        return Object.freeze(result);
    }

}

export default TheoryGraph;
