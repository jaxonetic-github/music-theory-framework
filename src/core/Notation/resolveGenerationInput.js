import {
    Chord, ChordPattern, GenerationResult, PitchClass, Scale, ScalePattern, TheoryGraph
} from "../Theory/index.js";
import { ValidationError } from "../Foundation/index.js";

function only(edges, type, description) {
    const matches = edges.filter(edge => String(edge.type) === type);
    if (matches.length !== 1) throw new ValidationError(`A notation theory graph requires exactly one ${description} edge.`);
    return matches[0];
}

function targetNode(graph, edge, expectedType, description) {
    const node = graph.node(edge.to);
    if (!node || String(node.type) !== expectedType) {
        throw new ValidationError(`The notation theory graph ${description} must target a ${expectedType} node.`);
    }
    return node;
}

export function resolveGenerationInput(input) {
    if (!(input instanceof GenerationResult) && !(input instanceof TheoryGraph)) {
        throw new ValidationError("NotationEngine requires a GenerationResult or TheoryGraph.");
    }
    const graph = input instanceof GenerationResult ? input.graph : input;
    const outputs = graph.nodes.filter(node => ["scale", "chord"].includes(String(node.type)));
    if (outputs.length !== 1) throw new ValidationError("A notation theory graph requires exactly one scale or chord output node.");
    const output = outputs[0];
    const kind = String(output.type);
    const outgoing = graph.edgesFrom(output.id);
    const rootEdge = only(outgoing, "rooted-at", "rooted-at");
    const patternEdge = only(outgoing, "uses-pattern", "uses-pattern");
    const rootNode = targetNode(graph, rootEdge, "pitch-class", "root edge");
    const patternNode = targetNode(graph, patternEdge, `${kind}-pattern`, "pattern edge");
    const root = PitchClass.from(rootNode.value);
    const pattern = kind === "scale" ? ScalePattern.from(patternNode.value) : ChordPattern.from(patternNode.value);

    const toneEdges = outgoing.filter(edge => String(edge.type) === "contains-tone");
    if (toneEdges.length !== pattern.intervals.length) {
        throw new ValidationError("The notation theory graph tone count must match its pattern intervals.");
    }
    const tones = toneEdges.map(edge => {
        const node = targetNode(graph, edge, "pitch-class", "contains-tone edge");
        const degree = Number(edge.metadata.attributes.degree);
        const semitones = Number(edge.metadata.attributes.semitones);
        if (!Number.isInteger(degree) || degree < 1) throw new ValidationError("Each notation tone edge requires a positive integer degree.");
        if (!Number.isInteger(semitones) || semitones < 0) throw new ValidationError("Each notation tone edge requires a non-negative integer interval.");
        return { degree, semitones, pitchClass: PitchClass.from(node.value) };
    }).sort((a, b) => a.degree - b.degree);

    tones.forEach((tone, index) => {
        const expectedDegree = index + 1;
        const expectedInterval = pattern.intervals[index];
        if (tone.degree !== expectedDegree) throw new ValidationError("Notation tone degrees must be unique and contiguous from 1.");
        if (tone.semitones !== expectedInterval) throw new ValidationError(`Notation tone degree ${tone.degree} does not match its pattern interval.`);
        if (tone.pitchClass.semitones !== (root.semitones + tone.semitones) % 12) {
            throw new ValidationError(`Notation tone degree ${tone.degree} does not match its root and interval.`);
        }
    });

    const pitchClasses = tones.map(tone => tone.pitchClass);
    const model = kind === "scale"
        ? new Scale({ root, pattern, pitchClasses })
        : new Chord({ root, pattern, pitchClasses });
    const generatorId = input instanceof GenerationResult ? input.generatorId : "notation.theory-graph";
    return new GenerationResult({ generatorId, model, graph });
}

export default resolveGenerationInput;
