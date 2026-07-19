import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExportResult } from "../Export/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { GenerationResult } from "../Theory/index.js";
import { ApplicationRequest } from "./ApplicationRequest.js";
import { RenderingOutput } from "./RenderingOutput.js";

export class ApplicationResult {
    constructor({ request, generation, score, rendering = null, exported = null, metadata = {} } = {}) {
        if (!(request instanceof ApplicationRequest)) throw new ValidationError("ApplicationResult requires an ApplicationRequest.");
        if (!(generation instanceof GenerationResult)) throw new ValidationError("ApplicationResult requires a GenerationResult.");
        if (!(score instanceof ScoreGraph)) throw new ValidationError("ApplicationResult requires a ScoreGraph.");
        if (rendering !== null && !(rendering instanceof RenderingOutput)) {
            throw new ValidationError("ApplicationResult rendering must be a RenderingOutput or null.");
        }
        if (exported !== null && !(exported instanceof ExportResult)) {
            throw new ValidationError("ApplicationResult exported value must be an ExportResult or null.");
        }
        Object.defineProperties(this, {
            request: { value: request, enumerable: true },
            generation: { value: generation, enumerable: true },
            score: { value: score, enumerable: true },
            rendering: { value: rendering, enumerable: true },
            export: { value: exported, enumerable: true },
            metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true }
        });
        Object.freeze(this);
    }
}

export default ApplicationResult;
