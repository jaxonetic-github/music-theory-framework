import { ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { PlaybackPlan } from "./PlaybackPlan.js";
import { PlaybackRequest } from "./PlaybackRequest.js";
import { PlaybackStrategyRegistry } from "./PlaybackStrategyRegistry.js";

export class PlaybackEngine {
    constructor(registry = new PlaybackStrategyRegistry()) {
        this.registry = registry;
        Object.seal(this);
    }

    plan(score, options = {}) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("PlaybackEngine.plan() requires a ScoreGraph.");
        const request = PlaybackRequest.from(options);
        const strategy = this.registry.select(score, request);
        if (!strategy) throw new ValidationError("No playback strategy supports this score graph.");
        const plan = strategy.plan(score, request);
        if (!(plan instanceof PlaybackPlan)) {
            throw new ValidationError(`Playback strategy "${strategy.id}" did not return a PlaybackPlan.`);
        }
        if (plan.request !== request) {
            throw new ValidationError(`Playback strategy "${strategy.id}" returned a plan for a different request.`);
        }
        if (request.resolution !== null && plan.resolution !== request.resolution) {
            throw new ValidationError(`Playback strategy "${strategy.id}" did not preserve the requested resolution.`);
        }
        if (String(plan.metadata.pluginId) !== String(strategy.pluginId)
            || String(plan.metadata.strategyId) !== String(strategy.id)) {
            throw new ValidationError(`Playback strategy "${strategy.id}" returned incompatible plan metadata.`);
        }
        return plan;
    }
}

export default PlaybackEngine;
