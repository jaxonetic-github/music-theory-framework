import { Identifier, ValidationError } from "../Foundation/index.js";
import { PlaybackStrategy } from "./strategies/PlaybackStrategy.js";

export class PlaybackStrategyRegistry {
    #plugins = new Map();
    #sequence = 0;

    register(pluginId, strategy, options = {}) {
        if (!(strategy instanceof PlaybackStrategy)) throw new ValidationError("A playback strategy must extend PlaybackStrategy.");
        const pluginKey = String(Identifier.from(pluginId));
        if (String(strategy.pluginId) !== pluginKey) {
            throw new ValidationError(`Playback strategy "${strategy.id}" belongs to plugin "${strategy.pluginId}", not "${pluginKey}".`);
        }
        const strategyKey = String(strategy.id);
        const strategies = this.#plugins.get(pluginKey) ?? new Map();
        if (strategies.has(strategyKey) && !options.replace) {
            throw new ValidationError(`Playback strategy "${strategyKey}" is already registered for plugin "${pluginKey}".`);
        }
        const previous = strategies.get(strategyKey);
        strategies.set(strategyKey, Object.freeze({ strategy, sequence: previous?.sequence ?? ++this.#sequence }));
        this.#plugins.set(pluginKey, strategies);
        return strategy;
    }

    get(pluginId, strategyId, options = {}) {
        const strategy = this.#plugins.get(String(pluginId))?.get(String(strategyId))?.strategy ?? null;
        if (!strategy && options.required) {
            throw new ValidationError(`Playback strategy "${String(strategyId)}" was not found for plugin "${String(pluginId)}".`);
        }
        return strategy;
    }

    select(score, options = {}) {
        const pluginId = options.pluginId === undefined || options.pluginId === null ? null : String(options.pluginId);
        if (options.strategyId !== undefined && options.strategyId !== null) {
            if (!pluginId) throw new ValidationError("Selecting a playback strategy by id requires a pluginId.");
            const strategy = this.get(pluginId, options.strategyId, { required: true });
            if (!strategy.supports(score, options)) throw new ValidationError(`Playback strategy "${strategy.id}" does not support this score graph.`);
            return strategy;
        }
        const records = [];
        for (const [owner, strategies] of this.#plugins) {
            if (pluginId && owner !== pluginId) continue;
            records.push(...strategies.values());
        }
        records.sort((left, right) => left.sequence - right.sequence);
        return records.find(record => record.strategy.supports(score, options))?.strategy ?? null;
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
        return Object.freeze([...(this.#plugins.get(String(pluginId))?.values() ?? [])]
            .sort((left, right) => left.sequence - right.sequence).map(record => record.strategy));
    }
}

export default PlaybackStrategyRegistry;
