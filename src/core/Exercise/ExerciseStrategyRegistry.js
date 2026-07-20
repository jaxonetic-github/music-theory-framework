import { Identifier, ValidationError } from "../Foundation/index.js";
import { ExerciseStrategy } from "./strategies/ExerciseStrategy.js";

export class ExerciseStrategyRegistry {
    #plugins = new Map();

    register(pluginId, strategy, options = {}) {
        if (!(strategy instanceof ExerciseStrategy)) throw new ValidationError("An exercise strategy must extend ExerciseStrategy.");
        const pluginKey = String(Identifier.from(pluginId));
        if (String(strategy.pluginId) !== pluginKey) throw new ValidationError(`Exercise strategy "${strategy.id}" belongs to plugin "${strategy.pluginId}", not "${pluginKey}".`);
        const strategyKey = String(strategy.id);
        const strategies = this.#plugins.get(pluginKey) ?? new Map();
        if (strategies.has(strategyKey) && !options.replace) throw new ValidationError(`Exercise strategy "${strategyKey}" is already registered for plugin "${pluginKey}".`);
        strategies.set(strategyKey, strategy);
        this.#plugins.set(pluginKey, strategies);
        return strategy;
    }

    get(pluginId, strategyId, options = {}) {
        const strategy = this.#plugins.get(String(pluginId))?.get(String(strategyId)) ?? null;
        if (!strategy && options.required) throw new ValidationError(`Exercise strategy "${String(strategyId)}" was not found for plugin "${String(pluginId)}".`);
        return strategy;
    }

    select(request) {
        const pluginId = request.pluginId;
        if (request.strategyId) {
            const strategy = this.get(pluginId, request.strategyId, { required: true });
            if (!strategy.supports(request)) throw new ValidationError(`Exercise strategy "${strategy.id}" does not support this request.`);
            return strategy;
        }
        const candidates = [];
        for (const [owner, strategies] of this.#plugins) {
            if (pluginId && owner !== pluginId) continue;
            for (const strategy of strategies.values()) candidates.push(strategy);
        }
        candidates.sort((left, right) => String(left.pluginId).localeCompare(String(right.pluginId)) || String(left.id).localeCompare(String(right.id)));
        return candidates.find(strategy => strategy.supports(request)) ?? null;
    }

    unregister(pluginId, strategyId) {
        const strategies = this.#plugins.get(String(pluginId));
        if (!strategies) return false;
        const removed = strategies.delete(String(strategyId));
        if (strategies.size === 0) this.#plugins.delete(String(pluginId));
        return removed;
    }
    unregisterPlugin(pluginId) { const values = this.#plugins.get(String(pluginId)); if (!values) return 0; this.#plugins.delete(String(pluginId)); return values.size; }
    strategies(pluginId) { return Object.freeze([...(this.#plugins.get(String(pluginId))?.values() ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))); }
}

export default ExerciseStrategyRegistry;
