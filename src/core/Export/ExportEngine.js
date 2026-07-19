import { ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { ExportResult } from "./ExportResult.js";
import { ExporterStrategyRegistry } from "./ExporterStrategyRegistry.js";

export class ExportEngine {
    constructor(registry = new ExporterStrategyRegistry()) {
        this.registry = registry;
        Object.seal(this);
    }

    export(score, format, options = {}) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("ExportEngine.export() requires a ScoreGraph.");
        const normalizedFormat = String(format ?? "").trim().toLowerCase();
        if (!normalizedFormat) throw new ValidationError("ExportEngine.export() requires a target format.");
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            throw new ValidationError("Export options must be an object.");
        }
        const strategy = this.registry.select(score, normalizedFormat, options);
        if (!strategy) throw new ValidationError(`No exporter strategy supports format "${normalizedFormat}" for this score graph.`);
        const result = strategy.export(score, options);
        if (!(result instanceof ExportResult)) {
            throw new ValidationError(`Exporter strategy "${strategy.id}" did not return an ExportResult.`);
        }
        if (result.format !== strategy.format || result.mediaType !== strategy.mediaType) {
            throw new ValidationError(`Exporter strategy "${strategy.id}" returned an incompatible export result.`);
        }
        return result;
    }
}

export default ExportEngine;
