import { PlaybackEngine } from "./PlaybackEngine.js";
import { PlaybackStrategyRegistry } from "./PlaybackStrategyRegistry.js";
import { ScorePlaybackPlanner } from "./strategies/index.js";
import { defaultPlaybackPluginDescriptor, playbackServiceDescriptors, playbackStrategyDescriptors } from "./descriptors.js";
import { playbackPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); }
        catch (error) { errors.push(error); }
    }
    return errors;
}

export class PlaybackModule {
    #configured = false;
    #ownsStrategy = false;
    #undo = [];

    constructor(options = {}) {
        this.id = String(playbackPackageDescriptor.id);
        this.descriptor = playbackPackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new PlaybackStrategyRegistry();
        this.scoreStrategy = options.scoreStrategy ?? new ScorePlaybackPlanner();
        this.strategyRegistry.register(this.scoreStrategy.pluginId, this.scoreStrategy);
        this.#ownsStrategy = true;
        this.engine = options.engine ?? new PlaybackEngine(this.strategyRegistry);
        this.plugin = Object.freeze({
            id: String(defaultPlaybackPluginDescriptor.id),
            strategies: Object.freeze([this.scoreStrategy])
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
        const ensureStrategy = () => {
            const existing = this.strategyRegistry.get(this.scoreStrategy.pluginId, this.scoreStrategy.id);
            if (existing === this.scoreStrategy) return;
            this.strategyRegistry.register(this.scoreStrategy.pluginId, this.scoreStrategy);
            this.#ownsStrategy = true;
            undo.push(() => {
                if (this.strategyRegistry.get(this.scoreStrategy.pluginId, this.scoreStrategy.id) === this.scoreStrategy) {
                    this.strategyRegistry.unregister(this.scoreStrategy.pluginId, this.scoreStrategy.id);
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
                if (!previousRecord && currentRecord?.descriptor === descriptor && currentRecord?.value === value) {
                    try { unregister(currentRecord); } catch {}
                }
                throw error;
            }
            undo.push(() => unregister(registeredRecord));
        };

        try {
            ensureStrategy();
            registerService("playback.engine", this.engine);
            registerService("playback.strategyRegistry", this.strategyRegistry);
            registerValue(registries.services, playbackServiceDescriptors.engine, this.engine);
            registerValue(registries.services, playbackServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.plugins, defaultPlaybackPluginDescriptor, this.plugin);
            registerValue(registries.renderers, playbackStrategyDescriptors.score, this.scoreStrategy);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollbackErrors = runUndo(undo);
            if (rollbackErrors.length) {
                throw new AggregateError([error, ...rollbackErrors], "PlaybackModule configuration and rollback failed.", { cause: error });
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
                && this.strategyRegistry.get(this.scoreStrategy.pluginId, this.scoreStrategy.id) === this.scoreStrategy) {
                this.strategyRegistry.unregister(this.scoreStrategy.pluginId, this.scoreStrategy.id);
            }
            this.#ownsStrategy = false;
        } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "PlaybackModule disposal failed.");
        return this;
    }
}

export default PlaybackModule;
