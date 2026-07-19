import { Chord, Note } from "../../Theory/index.js";
import { Duration } from "../values/index.js";
import { ChordNode } from "../graph/index.js";
import { NotationStrategy } from "./NotationStrategy.js";
import { buildScoreGraph } from "./buildScoreGraph.js";

export class ChordNotationStrategy extends NotationStrategy {
    constructor({ pluginId = "core.notation.defaults" } = {}) {
        super({ id: "chord", pluginId, inputType: "chord" });
    }

    supports(result) { return result?.model instanceof Chord; }

    notate(result, options = {}) {
        const octave = Number(options.octave ?? 4);
        const duration = Duration.from(options.duration ?? { numerator: 1, denominator: 1 });
        const tonic = new Note(result.model.root, octave);
        const notes = result.model.pattern.intervals.map(interval => tonic.transpose(interval, { prefer: result.model.root.prefer }));
        const event = new ChordNode({ id: "chord:1", notes, duration, offset: 0 });
        return buildScoreGraph({ title: options.title ?? result.model.toString(), events: [event] });
    }
}

export default ChordNotationStrategy;
