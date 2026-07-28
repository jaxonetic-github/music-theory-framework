import { ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { RendererStrategyRegistry } from "./RendererStrategyRegistry.js";
import { LayoutEngine, LayoutPlan, LayoutStrategyRegistry, ScoreGraphLayoutStrategy } from "../Layout/index.js";

function defaultLayoutEngine() { const registry = new LayoutStrategyRegistry(), strategy = new ScoreGraphLayoutStrategy(); registry.register(strategy.pluginId, strategy); return new LayoutEngine(registry); }

export class RenderingEngine {
    constructor(registry = new RendererStrategyRegistry(), layoutEngine = defaultLayoutEngine()) {
        this.registry = registry;
        this.layoutEngine = layoutEngine;
        Object.seal(this);
    }

    render(score, options = {}) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("RenderingEngine.render() requires a ScoreGraph.");
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            throw new ValidationError("Rendering options must be an object.");
        }
        const strategy = this.registry.select(score, options);
        if (!strategy) throw new ValidationError("No renderer strategy supports this score graph.");
        const layoutPlan = options.layoutPlan ?? this.layout(score, options);
        if (!(layoutPlan instanceof LayoutPlan) || layoutPlan.score !== score) throw new ValidationError("Rendering layoutPlan must belong to the rendered ScoreGraph.");
        const output = strategy.render(score, { ...options, layoutPlan });
        if (typeof output !== "string" || !output.trim()) {
            throw new ValidationError(`Renderer strategy "${strategy.id}" did not return non-empty string output.`);
        }
        return output;
    }

    layout(score, options = {}) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("RenderingEngine.layout() requires a ScoreGraph.");
        if (options.width !== undefined && (!Number.isFinite(Number(options.width)) || Number(options.width) <= 0)) throw new ValidationError("SVG width must be a positive finite number.");
        return this.layoutEngine.plan({ score, availableWidth: options.width ?? 1200, profile: options.layoutProfile ?? "screen-regular", horizontalPadding: options.horizontalPadding, minimumSystemWidth: options.minimumSystemWidth, staffSpacing: options.staffSpacing, systemSpacing: options.systemSpacing, semanticSystems: options.semanticSystems, pluginId: options.layoutPluginId, strategyId: options.layoutStrategyId });
    }
}

export default RenderingEngine;
