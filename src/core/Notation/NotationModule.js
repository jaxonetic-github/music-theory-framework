import { NotationEngine } from "./NotationEngine.js";
import { NotationStrategyRegistry } from "./NotationStrategyRegistry.js";
import { ChordNotationStrategy, ScaleNotationStrategy } from "./strategies/index.js";
import {
    defaultNotationPluginDescriptor, notationRendererDescriptors, notationServiceDescriptors
} from "./descriptors.js";
import { notationPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); }
        catch (error) { errors.push(error); }
    }
    return errors;
}

export class NotationModule {
    #configured = false;
    #undo = [];

    constructor(options = {}) {
        this.id = String(notationPackageDescriptor.id);
        this.descriptor = notationPackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new NotationStrategyRegistry();
        this.scaleStrategy = options.scaleStrategy ?? new ScaleNotationStrategy();
        this.chordStrategy = options.chordStrategy ?? new ChordNotationStrategy();
        this.strategyRegistry.register(this.scaleStrategy.pluginId, this.scaleStrategy);
        this.strategyRegistry.register(this.chordStrategy.pluginId, this.chordStrategy);
        this.engine = options.engine ?? new NotationEngine(this.strategyRegistry);
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const undo = [];
        const plugin = Object.freeze({
            id: String(defaultNotationPluginDescriptor.id),
            strategies: Object.freeze([this.scaleStrategy, this.chordStrategy])
        });
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

        try {
            registerService("notation.engine", this.engine);
            registerService("notation.strategyRegistry", this.strategyRegistry);
            registerValue(registries.services, notationServiceDescriptors.engine, this.engine);
            registerValue(registries.services, notationServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.plugins, defaultNotationPluginDescriptor, plugin);
            registerValue(registries.renderers, notationRendererDescriptors.scale, this.scaleStrategy);
            registerValue(registries.renderers, notationRendererDescriptors.chord, this.chordStrategy);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollbackErrors = runUndo(undo);
            if (rollbackErrors.length) {
                throw new AggregateError([error, ...rollbackErrors], "NotationModule configuration and rollback failed.", { cause: error });
            }
            throw error;
        }
    }

    dispose() {
        const undo = this.#undo;
        this.#undo = [];
        this.#configured = false;
        const errors = runUndo(undo);
        try {
            if (this.strategyRegistry.get(this.scaleStrategy.pluginId, this.scaleStrategy.id) === this.scaleStrategy) {
                this.strategyRegistry.unregister(this.scaleStrategy.pluginId, this.scaleStrategy.id);
            }
        } catch (error) { errors.push(error); }
        try {
            if (this.strategyRegistry.get(this.chordStrategy.pluginId, this.chordStrategy.id) === this.chordStrategy) {
                this.strategyRegistry.unregister(this.chordStrategy.pluginId, this.chordStrategy.id);
            }
        } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "NotationModule disposal failed.");
        return this;
    }
}

export default NotationModule;
