import { RenderingEngine } from "./RenderingEngine.js";
import { RendererStrategyRegistry } from "./RendererStrategyRegistry.js";
import { SvgScoreRenderer } from "./strategies/index.js";
import {
    defaultRenderingPluginDescriptor, renderingRendererDescriptors, renderingServiceDescriptors
} from "./descriptors.js";
import { renderingPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); }
        catch (error) { errors.push(error); }
    }
    return errors;
}

export class RenderingModule {
    #configured = false;
    #ownsStrategy = false;
    #undo = [];

    constructor(options = {}) {
        this.id = String(renderingPackageDescriptor.id);
        this.descriptor = renderingPackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new RendererStrategyRegistry();
        this.svgStrategy = options.svgStrategy ?? new SvgScoreRenderer();
        this.strategyRegistry.register(this.svgStrategy.pluginId, this.svgStrategy);
        this.#ownsStrategy = true;
        this.engine = options.engine ?? new RenderingEngine(this.strategyRegistry);
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const undo = [];
        const plugin = Object.freeze({
            id: String(defaultRenderingPluginDescriptor.id),
            strategies: Object.freeze([this.svgStrategy])
        });
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => {
                if (services.resolve(id, { optional: true }) === value) services.unregister(id);
            });
        };
        const ensureStrategy = () => {
            const existing = this.strategyRegistry.get(this.svgStrategy.pluginId, this.svgStrategy.id);
            if (existing === this.svgStrategy) return;
            this.strategyRegistry.register(this.svgStrategy.pluginId, this.svgStrategy);
            this.#ownsStrategy = true;
            undo.push(() => {
                if (this.strategyRegistry.get(this.svgStrategy.pluginId, this.svgStrategy.id) === this.svgStrategy) {
                    this.strategyRegistry.unregister(this.svgStrategy.pluginId, this.svgStrategy.id);
                }
                this.#ownsStrategy = false;
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
            ensureStrategy();
            registerService("rendering.engine", this.engine);
            registerService("rendering.strategyRegistry", this.strategyRegistry);
            registerValue(registries.services, renderingServiceDescriptors.engine, this.engine);
            registerValue(registries.services, renderingServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.plugins, defaultRenderingPluginDescriptor, plugin);
            registerValue(registries.renderers, renderingRendererDescriptors.svg, this.svgStrategy);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollbackErrors = runUndo(undo);
            if (rollbackErrors.length) {
                throw new AggregateError([error, ...rollbackErrors], "RenderingModule configuration and rollback failed.", { cause: error });
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
            if (this.#ownsStrategy
                && this.strategyRegistry.get(this.svgStrategy.pluginId, this.svgStrategy.id) === this.svgStrategy) {
                this.strategyRegistry.unregister(this.svgStrategy.pluginId, this.svgStrategy.id);
            }
            this.#ownsStrategy = false;
        } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "RenderingModule disposal failed.");
        return this;
    }
}

export default RenderingModule;
