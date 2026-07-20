import { ExerciseEngine } from "./ExerciseEngine.js";
import { ExerciseStrategyRegistry } from "./ExerciseStrategyRegistry.js";
import { FoundationalExerciseStrategy } from "./strategies/index.js";
import { defaultExercisePluginDescriptor, exerciseServiceDescriptors, exerciseStrategyDescriptors } from "./descriptors.js";
import { exercisePackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) { const errors = []; for (const undo of [...actions].reverse()) { try { undo(); } catch (error) { errors.push(error); } } return errors; }

export class ExerciseModule {
    #configured = false;
    #ownsStrategy = false;
    #undo = [];
    constructor(options = {}) {
        this.id = String(exercisePackageDescriptor.id);
        this.descriptor = exercisePackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new ExerciseStrategyRegistry();
        this.foundationalStrategy = options.foundationalStrategy ?? new FoundationalExerciseStrategy(options);
        this.strategyRegistry.register(this.foundationalStrategy.pluginId, this.foundationalStrategy);
        this.#ownsStrategy = true;
        this.engine = options.engine ?? new ExerciseEngine(this.strategyRegistry);
        this.plugin = Object.freeze({ id: String(defaultExercisePluginDescriptor.id), strategies: Object.freeze([this.foundationalStrategy]) });
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const undo = [];
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => { if (services.resolve(id, { optional: true }) === value) services.unregister(id); });
        };
        const ensureStrategy = () => {
            const existing = this.strategyRegistry.get(this.foundationalStrategy.pluginId, this.foundationalStrategy.id);
            if (existing === this.foundationalStrategy) return;
            this.strategyRegistry.register(this.foundationalStrategy.pluginId, this.foundationalStrategy);
            this.#ownsStrategy = true;
            undo.push(() => {
                if (this.strategyRegistry.get(this.foundationalStrategy.pluginId, this.foundationalStrategy.id) === this.foundationalStrategy) {
                    this.strategyRegistry.unregister(this.foundationalStrategy.pluginId, this.foundationalStrategy.id);
                }
                this.#ownsStrategy = false;
            });
        };
        const registerValue = (registry, descriptor, value) => {
            const previous = registry.getRecord(descriptor.id);
            let record = null;
            const unregister = current => { if (registry.getRecord(descriptor.id) === current) registry.unregister(descriptor.id); };
            try { record = registry.register(descriptor, { value }); }
            catch (error) {
                const current = registry.getRecord(descriptor.id);
                if (!previous && current?.descriptor === descriptor && current?.value === value) { try { unregister(current); } catch {} }
                throw error;
            }
            undo.push(() => unregister(record));
        };
        try {
            ensureStrategy();
            registerService("exercise.engine", this.engine);
            registerService("exercise.strategyRegistry", this.strategyRegistry);
            registerValue(registries.services, exerciseServiceDescriptors.engine, this.engine);
            registerValue(registries.services, exerciseServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.plugins, defaultExercisePluginDescriptor, this.plugin);
            registerValue(registries.exercises, exerciseStrategyDescriptors.foundational, this.foundationalStrategy);
            this.#undo = undo; this.#configured = true; return this;
        } catch (error) {
            const rollback = runUndo(undo);
            if (rollback.length) throw new AggregateError([error, ...rollback], "ExerciseModule configuration and rollback failed.", { cause: error });
            throw error;
        }
    }

    dispose() {
        const undo = this.#undo; this.#undo = []; this.#configured = false;
        const errors = runUndo(undo);
        try {
            if (this.#ownsStrategy && this.strategyRegistry.get(this.foundationalStrategy.pluginId, this.foundationalStrategy.id) === this.foundationalStrategy) {
                this.strategyRegistry.unregister(this.foundationalStrategy.pluginId, this.foundationalStrategy.id);
            }
            this.#ownsStrategy = false;
        } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "ExerciseModule disposal failed.");
        return this;
    }
}

export default ExerciseModule;
