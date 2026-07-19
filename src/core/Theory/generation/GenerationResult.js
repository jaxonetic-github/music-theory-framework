import { Identifier, ImmutableValue, ValidationError } from "../../Foundation/index.js";
import { Chord, Scale } from "../models/index.js";
import { TheoryGraph } from "../graph/index.js";

export class GenerationResult extends ImmutableValue {
    constructor({ generatorId, model, graph } = {}) {
        if (!(model instanceof Scale) && !(model instanceof Chord)) {
            throw new ValidationError("A generation result model must be a Scale or Chord.");
        }
        super({ generatorId: Identifier.from(generatorId), model, graph: TheoryGraph.from(graph) });
    }

    static fromModel(model, generatorId) {
        const kind = model instanceof Scale ? "scale" : model instanceof Chord ? "chord" : null;
        if (!kind) throw new ValidationError("Cannot create a generation result for an unsupported model.");
        const outputId = `output:${kind}`;
        const nodes = [
            { id: outputId, type: kind, value: model },
            { id: "input:root", type: "pitch-class", value: model.root },
            { id: "input:pattern", type: `${kind}-pattern`, value: model.pattern },
            ...model.pitchClasses.map((pitchClass, index) => ({ id: `tone:${index + 1}`, type: "pitch-class", value: pitchClass }))
        ];
        const edges = [
            { from: outputId, to: "input:root", type: "rooted-at" },
            { from: outputId, to: "input:pattern", type: "uses-pattern" },
            ...model.pitchClasses.map((pitchClass, index) => ({
                from: outputId,
                to: `tone:${index + 1}`,
                type: "contains-tone",
                metadata: { degree: index + 1, semitones: model.pattern.intervals[index] }
            }))
        ];
        return new GenerationResult({ generatorId, model, graph: new TheoryGraph({ nodes, edges }) });
    }
}

export default GenerationResult;
