import { ValidationError } from "../Foundation/index.js";
import { ExerciseModel } from "./ExerciseModel.js";
import { ExerciseRequest } from "./ExerciseRequest.js";
import { ExerciseStrategyRegistry } from "./ExerciseStrategyRegistry.js";

export class ExerciseEngine {
    constructor(registry = new ExerciseStrategyRegistry()) { this.registry = registry; Object.seal(this); }
    generate(value = {}) {
        const request = ExerciseRequest.from(value);
        const strategy = this.registry.select(request);
        if (!strategy) throw new ValidationError("No exercise strategy supports this request.");
        const model = strategy.generate(request);
        if (!(model instanceof ExerciseModel)) throw new ValidationError(`Exercise strategy "${strategy.id}" did not return an ExerciseModel.`);
        if (model.request !== request) throw new ValidationError(`Exercise strategy "${strategy.id}" returned a model for a different request.`);
        if (model.id !== request.identity) throw new ValidationError(`Exercise strategy "${strategy.id}" returned a model with an incompatible semantic identity.`);
        if (String(model.metadata.pluginId) !== String(strategy.pluginId) || String(model.metadata.strategyId) !== String(strategy.id)) {
            throw new ValidationError(`Exercise strategy "${strategy.id}" returned incompatible model metadata.`);
        }
        return model;
    }
}

export default ExerciseEngine;
