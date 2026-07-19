import { ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { RendererStrategyRegistry } from "./RendererStrategyRegistry.js";

export class RenderingEngine {
    constructor(registry = new RendererStrategyRegistry()) {
        this.registry = registry;
        Object.seal(this);
    }

    render(score, options = {}) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("RenderingEngine.render() requires a ScoreGraph.");
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            throw new ValidationError("Rendering options must be an object.");
        }
        const strategy = this.registry.select(score, options);
        if (!strategy) throw new ValidationError("No renderer strategy supports this score graph.");
        const output = strategy.render(score, options);
        if (typeof output !== "string" || !output.trim()) {
            throw new ValidationError(`Renderer strategy "${strategy.id}" did not return non-empty string output.`);
        }
        return output;
    }
}

export default RenderingEngine;
