import { Identifier, ValidationError } from "../Foundation/index.js";
import { NotationStrategy } from "./strategies/index.js";

export class NotationStrategyRegistry {
    #plugins = new Map();

    register(pluginId, strategy, options = {}) {
        if (!(strategy instanceof NotationStrategy)) throw new ValidationError("A notation strategy must extend NotationStrategy.");
        const pluginKey = String(Identifier.from(pluginId));
        if (String(strategy.pluginId) !== pluginKey) throw new ValidationError(`Strategy "${strategy.id}" belongs to plugin "${strategy.pluginId}", not "${pluginKey}".`);
        const strategyKey = String(strategy.id);
        const strategies = this.#plugins.get(pluginKey) ?? new Map();
        if (strategies.has(strategyKey) && !options.replace) {
            throw new ValidationError(`Notation strategy "${strategyKey}" is already registered for plugin "${pluginKey}".`);
        }
        strategies.set(strategyKey, strategy);
        this.#plugins.set(pluginKey, strategies);
        return strategy;
    }

    get(pluginId, strategyId, options = {}) {
        const strategy = this.#plugins.get(String(pluginId))?.get(String(strategyId)) ?? null;
        if (!strategy && options.required) throw new ValidationError(`Notation strategy "${String(strategyId)}" was not found for plugin "${String(pluginId)}".`);
        return strategy;
    }

    select(result, options = {}) {
        const pluginId = options.pluginId === undefined ? null : String(options.pluginId);
        if (options.strategyId !== undefined) {
            if (!pluginId) throw new ValidationError("Selecting a notation strategy by id requires a pluginId.");
            const strategy = this.get(pluginId, options.strategyId, { required: true });
            if (!strategy.supports(result)) throw new ValidationError(`Notation strategy "${strategy.id}" does not support this generation result.`);
            return strategy;
        }
        const records = [];
        for (const [owner, strategies] of [...this.#plugins].sort(([a], [b]) => a.localeCompare(b))) {
            if (pluginId && owner !== pluginId) continue;
            records.push(...[...strategies].sort(([a], [b]) => a.localeCompare(b)).map(([, strategy]) => strategy));
        }
        return records.find(strategy => strategy.supports(result)) ?? null;
    }

    unregister(pluginId, strategyId) {
        const key = String(pluginId);
        const strategies = this.#plugins.get(key);
        if (!strategies) return false;
        const removed = strategies.delete(String(strategyId));
        if (strategies.size === 0) this.#plugins.delete(key);
        return removed;
    }

    unregisterPlugin(pluginId) {
        const strategies = this.#plugins.get(String(pluginId));
        if (!strategies) return 0;
        const count = strategies.size;
        this.#plugins.delete(String(pluginId));
        return count;
    }

    strategies(pluginId) {
        return Object.freeze([...(this.#plugins.get(String(pluginId))?.entries() ?? [])]
            .sort(([a], [b]) => a.localeCompare(b)).map(([, strategy]) => strategy));
    }
}

export default NotationStrategyRegistry;
