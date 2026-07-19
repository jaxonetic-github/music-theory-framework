import { Chord } from "../../Theory/index.js";
import { Duration } from "../values/index.js";
import { ChordNode } from "../graph/index.js";
import { NotationStrategy } from "./NotationStrategy.js";
import { buildScoreGraph } from "./buildScoreGraph.js";
import { resolveNotationNotes } from "./resolveNotationNotes.js";

export class ChordNotationStrategy extends NotationStrategy {
    constructor({ pluginId = "core.notation.defaults" } = {}) {
        super({ id: "chord", pluginId, inputType: "chord" });
    }

    supports(result) { return result?.model instanceof Chord; }

    notate(result, options = {}) {
        const duration = Duration.from(options.duration ?? { numerator: 1, denominator: 1 });
        const notes = resolveNotationNotes(result.model, options);
        const event = new ChordNode({ id: "chord:1", notes, duration, offset: 0 });
        return buildScoreGraph({ title: options.title ?? result.model.toString(), events: [event] });
    }
}

export default ChordNotationStrategy;
