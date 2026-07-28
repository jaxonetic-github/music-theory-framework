import { LayoutEngine } from "./LayoutEngine.js";
import { LayoutStrategyRegistry } from "./LayoutStrategyRegistry.js";
import { ScoreGraphLayoutStrategy } from "./ScoreGraphLayoutStrategy.js";
import { defaultLayoutPluginDescriptor, layoutServiceDescriptors } from "./descriptors.js";
import { layoutPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); }
        catch (error) { errors.push(error); }
    }
    return errors;
}

export class LayoutModule {
    #configured = false;
    #ownsStrategy = false;
    #undo = [];

    constructor({
        strategyRegistry = new LayoutStrategyRegistry(),
        strategy = new ScoreGraphLayoutStrategy(),
        engine = null
    } = {}) {
        this.id = String(layoutPackageDescriptor.id);
        this.descriptor = layoutPackageDescriptor;
        this.strategyRegistry = strategyRegistry;
        this.strategy = strategy;
        if (!strategyRegistry.get(strategy.pluginId, strategy.id)) {
            strategyRegistry.register(strategy.pluginId, strategy);
            this.#ownsStrategy = true;
        }
        this.engine = engine ?? new LayoutEngine(strategyRegistry);
        this.plugin = Object.freeze({
            id: String(defaultLayoutPluginDescriptor.id),
            strategies: Object.freeze([strategy])
        });
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const undo = [];
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => {
                if (services.resolve(id, { optional: true }) === value) services.unregister(id);
            });
        };
        const registerValue = (registry, descriptor, value) => {
            const previousRecord = registry.getRecord(descriptor.id);
            let registeredRecord = null;
            const unregister = record => {
                if (registry.getRecord(descriptor.id) === record) registry.unregister(descriptor.id);
            };
            try { registeredRecord = registry.register(descriptor, { value }); }
            catch (error) {
                const currentRecord = registry.getRecord(descriptor.id);
                if (!previousRecord
                    && currentRecord?.descriptor === descriptor
                    && currentRecord?.value === value) {
                    try { unregister(currentRecord); } catch {}
                }
                throw error;
            }
            undo.push(() => unregister(registeredRecord));
        };
        const ensureStrategy = () => {
            const existing = this.strategyRegistry.get(this.strategy.pluginId, this.strategy.id);
            if (existing === this.strategy) return;
            this.strategyRegistry.register(this.strategy.pluginId, this.strategy);
            this.#ownsStrategy = true;
            undo.push(() => {
                if (this.strategyRegistry.get(this.strategy.pluginId, this.strategy.id) === this.strategy) {
                    this.strategyRegistry.unregister(this.strategy.pluginId, this.strategy.id);
                }
                this.#ownsStrategy = false;
            });
        };

        try {
            ensureStrategy();
            registerService("layout.engine", this.engine);
            registerService("layout.strategyRegistry", this.strategyRegistry);
            registerValue(registries.services, layoutServiceDescriptors.engine, this.engine);
            registerValue(registries.services, layoutServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.plugins, defaultLayoutPluginDescriptor, this.plugin);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollbackErrors = runUndo(undo);
            if (rollbackErrors.length) {
                throw new AggregateError(
                    [error, ...rollbackErrors],
                    "LayoutModule configuration and rollback failed.",
                    { cause: error }
                );
            }
            throw error;
        }
    }

    dispose() {
        const errors = runUndo(this.#undo);
        this.#undo = [];
        this.#configured = false;
        try {
            if (this.#ownsStrategy
                && this.strategyRegistry.get(this.strategy.pluginId, this.strategy.id) === this.strategy) {
                this.strategyRegistry.unregister(this.strategy.pluginId, this.strategy.id);
            }
            this.#ownsStrategy = false;
        } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "LayoutModule disposal failed.");
        return this;
    }
}

export default LayoutModule;
