import { ScoreEdge, ScoreGraph, ScoreRootNode, PartNode, MeasureNode, VoiceNode } from "../graph/index.js";

export function buildScoreGraph({ title, events }) {
    const structuralNodes = [
        new ScoreRootNode({ id: "score", title }),
        new PartNode({ id: "part:1", name: "Theory", instrument: "piano" }),
        new MeasureNode({ id: "measure:1", number: 1, beats: 4, beatUnit: 4 }),
        new VoiceNode({ id: "voice:1", index: 1 })
    ];
    const nodes = [...structuralNodes, ...events];
    const edges = [
        new ScoreEdge({ from: "score", to: "part:1", type: "contains" }),
        new ScoreEdge({ from: "part:1", to: "measure:1", type: "contains" }),
        new ScoreEdge({ from: "measure:1", to: "voice:1", type: "contains" }),
        ...events.map(event => new ScoreEdge({ from: "voice:1", to: event.id, type: "contains" })),
        ...events.slice(1).map((event, index) => new ScoreEdge({ from: events[index].id, to: event.id, type: "next" }))
    ];
    return new ScoreGraph({ nodes, edges });
}

export default buildScoreGraph;
