import { ValidationError } from "../Foundation/index.js";
import { LayoutRequest } from "./LayoutRequest.js";
import { LayoutPlan } from "./values.js";
import { LayoutStrategyRegistry } from "./LayoutStrategyRegistry.js";

function validatePlan(plan, request, strategy) {
    if (!(plan instanceof LayoutPlan) || plan.request !== request || plan.score !== request.score) {
        throw new ValidationError(`Layout strategy "${strategy.id}" returned an incompatible plan.`);
    }
    const score = request.score;
    const eventIds = new Set(score.nodes.filter(node => ["note", "rest", "chord"].includes(String(node.type))).map(node => String(node.id)));
    const measureIds = new Set(score.nodesOfType("measure").map(node => String(node.id)));
    const contains = new Set(score.edges
        .filter(edge => String(edge.type) === "contains")
        .map(edge => `${String(edge.from)}\0${String(edge.to)}`));
    const seenEvents = new Set(), seenMeasures = new Set();
    for (const system of plan.systems) {
        if (String(score.node(system.partId)?.type) !== "part") throw new ValidationError(`Layout system "${system.id}" references unknown part "${system.partId}".`);
        for (const measure of system.measures) {
            if (String(score.node(measure.id)?.type) !== "measure") throw new ValidationError(`Layout system "${system.id}" references unknown measure "${measure.id}".`);
            if (seenMeasures.has(measure.id)) throw new ValidationError(`Layout measure "${measure.id}" was placed more than once.`);
            seenMeasures.add(measure.id);
            for (const placement of measure.eventPlacements) {
                if (!eventIds.has(placement.eventId)) throw new ValidationError(`Layout measure "${measure.id}" references unknown event "${placement.eventId}".`);
                if (placement.measureId !== measure.id) throw new ValidationError(`Layout event "${placement.eventId}" has incompatible measure identity.`);
                if (String(score.node(placement.voiceId)?.type) !== "voice") throw new ValidationError(`Layout event "${placement.eventId}" references unknown voice "${placement.voiceId}".`);
                if (!contains.has(`${measure.id}\0${placement.voiceId}`)
                    || !contains.has(`${placement.voiceId}\0${placement.eventId}`)) {
                    throw new ValidationError(`Layout event "${placement.eventId}" is outside its authoritative measure and voice.`);
                }
                if (seenEvents.has(placement.eventId)) throw new ValidationError(`Layout event "${placement.eventId}" was placed more than once.`);
                seenEvents.add(placement.eventId);
            }
        }
    }
    if (seenMeasures.size !== measureIds.size) throw new ValidationError("Layout plan does not place every ScoreGraph measure.");
    if (seenEvents.size !== eventIds.size) throw new ValidationError("Layout plan does not place every atomic ScoreGraph event.");
    if (plan.metadata.strategy?.pluginId !== String(strategy.pluginId)
        || plan.metadata.strategy?.strategyId !== String(strategy.id)) {
        throw new ValidationError("Layout plan strategy metadata does not match the selected strategy.");
    }
    return plan;
}

export class LayoutEngine {
    constructor(registry = new LayoutStrategyRegistry()) {
        this.registry = registry;
        Object.freeze(this);
    }

    plan(input) {
        const request = LayoutRequest.from(input), strategy = this.registry.select(request);
        if (!strategy) throw new ValidationError("No layout strategy supports this request.");
        return validatePlan(strategy.layout(request), request, strategy);
    }
}

export default LayoutEngine;
