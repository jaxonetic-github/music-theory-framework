import { ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "./graph/index.js";
import { NotationStrategyRegistry } from "./NotationStrategyRegistry.js";
import { resolveGenerationInput } from "./resolveGenerationInput.js";

export class NotationEngine {
    constructor(registry = new NotationStrategyRegistry()) {
        this.registry = registry;
        Object.seal(this);
    }

    notate(input, options = {}) {
        const result = resolveGenerationInput(input);
        const strategy = this.registry.select(result, options);
        if (!strategy) throw new ValidationError("No notation strategy supports this generation result.");
        const graph = strategy.notate(result, options);
        if (!(graph instanceof ScoreGraph)) throw new ValidationError(`Notation strategy "${strategy.id}" did not return a ScoreGraph.`);
        return graph;
    }
}

export default NotationEngine;
