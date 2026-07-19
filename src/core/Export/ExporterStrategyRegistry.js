import { Identifier, ValidationError } from "../Foundation/index.js";
import { ExporterStrategy } from "./strategies/index.js";

export class ExporterStrategyRegistry {
    #plugins = new Map();
    #sequence = 0;

    register(pluginId, strategy, options = {}) {
        if (!(strategy instanceof ExporterStrategy)) throw new ValidationError("An exporter strategy must extend ExporterStrategy.");
        const pluginKey = String(Identifier.from(pluginId));
        if (String(strategy.pluginId) !== pluginKey) {
            throw new ValidationError(`Exporter "${strategy.id}" belongs to plugin "${strategy.pluginId}", not "${pluginKey}".`);
        }
        const strategyKey = String(strategy.id);
        const strategies = this.#plugins.get(pluginKey) ?? new Map();
        if (strategies.has(strategyKey) && !options.replace) {
            throw new ValidationError(`Exporter strategy "${strategyKey}" is already registered for plugin "${pluginKey}".`);
        }
        const previous = strategies.get(strategyKey);
        strategies.set(strategyKey, Object.freeze({ strategy, sequence: previous?.sequence ?? ++this.#sequence }));
        this.#plugins.set(pluginKey, strategies);
        return strategy;
    }

    get(pluginId, strategyId, options = {}) {
        const strategy = this.#plugins.get(String(pluginId))?.get(String(strategyId))?.strategy ?? null;
        if (!strategy && options.required) {
            throw new ValidationError(`Exporter strategy "${String(strategyId)}" was not found for plugin "${String(pluginId)}".`);
        }
        return strategy;
    }

    select(score, format, options = {}) {
        const normalizedFormat = String(format).toLowerCase();
        const pluginId = options.pluginId === undefined ? null : String(options.pluginId);
        if (options.strategyId !== undefined) {
            if (!pluginId) throw new ValidationError("Selecting an exporter strategy by id requires a pluginId.");
            const strategy = this.get(pluginId, options.strategyId, { required: true });
            if (strategy.format !== normalizedFormat) {
                throw new ValidationError(`Exporter strategy "${strategy.id}" produces "${strategy.format}", not "${normalizedFormat}".`);
            }
            if (!strategy.supports(score, options)) {
                throw new ValidationError(`Exporter strategy "${strategy.id}" does not support this score graph.`);
            }
            return strategy;
        }
        const records = [];
        for (const [owner, strategies] of this.#plugins) {
            if (pluginId && owner !== pluginId) continue;
            records.push(...strategies.values());
        }
        records.sort((left, right) => left.sequence - right.sequence);
        return records.find(record => record.strategy.format === normalizedFormat
            && record.strategy.supports(score, options))?.strategy ?? null;
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

export default ExporterStrategyRegistry;
