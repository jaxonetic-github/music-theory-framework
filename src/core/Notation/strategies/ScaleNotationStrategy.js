import { Note, Scale } from "../../Theory/index.js";
import { Duration } from "../values/index.js";
import { NoteNode } from "../graph/index.js";
import { NotationStrategy } from "./NotationStrategy.js";
import { buildScoreGraph } from "./buildScoreGraph.js";

export class ScaleNotationStrategy extends NotationStrategy {
    constructor({ pluginId = "core.notation.defaults" } = {}) {
        super({ id: "scale", pluginId, inputType: "scale" });
    }

    supports(result) { return result?.model instanceof Scale; }

    notate(result, options = {}) {
        const octave = Number(options.octave ?? 4);
        const duration = Duration.from(options.duration ?? { numerator: 1, denominator: 4 });
        const tonic = new Note(result.model.root, octave);
        const events = result.model.pattern.intervals.map((interval, index) => new NoteNode({
            id: `note:${index + 1}`,
            pitch: tonic.transpose(interval, { prefer: result.model.root.prefer }),
            duration,
            offset: index,
            metadata: { degree: index + 1 }
        }));
        return buildScoreGraph({ title: options.title ?? result.model.toString(), events });
    }
}

export default ScaleNotationStrategy;
