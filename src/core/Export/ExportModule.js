import { ExportEngine } from "./ExportEngine.js";
import { ExporterStrategyRegistry } from "./ExporterStrategyRegistry.js";
import { MusicXmlExporter } from "./strategies/index.js";
import {
    defaultExportPluginDescriptor, exportExporterDescriptors, exportServiceDescriptors
} from "./descriptors.js";
import { exportPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); }
        catch (error) { errors.push(error); }
    }
    return errors;
}

export class ExportModule {
    #configured = false;
    #ownsStrategy = false;
    #undo = [];

    constructor(options = {}) {
        this.id = String(exportPackageDescriptor.id);
        this.descriptor = exportPackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new ExporterStrategyRegistry();
        this.musicXmlStrategy = options.musicXmlStrategy ?? new MusicXmlExporter();
        this.strategyRegistry.register(this.musicXmlStrategy.pluginId, this.musicXmlStrategy);
        this.#ownsStrategy = true;
        this.engine = options.engine ?? new ExportEngine(this.strategyRegistry);
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const undo = [];
        const plugin = Object.freeze({
            id: String(defaultExportPluginDescriptor.id),
            strategies: Object.freeze([this.musicXmlStrategy])
        });
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => {
                if (services.resolve(id, { optional: true }) === value) services.unregister(id);
            });
        };
        const ensureStrategy = () => {
            const existing = this.strategyRegistry.get(this.musicXmlStrategy.pluginId, this.musicXmlStrategy.id);
            if (existing === this.musicXmlStrategy) return;
            this.strategyRegistry.register(this.musicXmlStrategy.pluginId, this.musicXmlStrategy);
            this.#ownsStrategy = true;
            undo.push(() => {
                if (this.strategyRegistry.get(this.musicXmlStrategy.pluginId, this.musicXmlStrategy.id) === this.musicXmlStrategy) {
                    this.strategyRegistry.unregister(this.musicXmlStrategy.pluginId, this.musicXmlStrategy.id);
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
            registerService("export.engine", this.engine);
            registerService("export.strategyRegistry", this.strategyRegistry);
            registerValue(registries.services, exportServiceDescriptors.engine, this.engine);
            registerValue(registries.services, exportServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.plugins, defaultExportPluginDescriptor, plugin);
            registerValue(registries.exporters, exportExporterDescriptors.musicxml, this.musicXmlStrategy);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollbackErrors = runUndo(undo);
            if (rollbackErrors.length) {
                throw new AggregateError([error, ...rollbackErrors], "ExportModule configuration and rollback failed.", { cause: error });
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
                && this.strategyRegistry.get(this.musicXmlStrategy.pluginId, this.musicXmlStrategy.id) === this.musicXmlStrategy) {
                this.strategyRegistry.unregister(this.musicXmlStrategy.pluginId, this.musicXmlStrategy.id);
            }
            this.#ownsStrategy = false;
        } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "ExportModule disposal failed.");
        return this;
    }
}

export default ExportModule;
