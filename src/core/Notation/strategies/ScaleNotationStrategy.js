import { Scale } from "../../Theory/index.js";
import { Duration } from "../values/index.js";
import { NoteNode } from "../graph/index.js";
import { NotationStrategy } from "./NotationStrategy.js";
import { buildScoreGraph } from "./buildScoreGraph.js";
import { resolveNotationNotes } from "./resolveNotationNotes.js";

export class ScaleNotationStrategy extends NotationStrategy {
    constructor({ pluginId = "core.notation.defaults" } = {}) {
        super({ id: "scale", pluginId, inputType: "scale" });
    }

    supports(result) { return result?.model instanceof Scale; }

    notate(result, options = {}) {
        const duration = Duration.from(options.duration ?? { numerator: 1, denominator: 4 });
        const notes = resolveNotationNotes(result.model, options);
        const events = notes.map((pitch, index) => new NoteNode({
            id: `note:${index + 1}`,
            pitch,
            duration,
            offset: index,
            metadata: { degree: index + 1 }
        }));
        return buildScoreGraph({ title: options.title ?? result.model.toString(), events });
    }
}

export default ScaleNotationStrategy;
