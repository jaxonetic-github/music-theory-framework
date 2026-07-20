import { ValidationError } from "../Foundation/index.js";
import { ExerciseEngine } from "./ExerciseEngine.js";
import { ExerciseStrategyRegistry } from "./ExerciseStrategyRegistry.js";
import { AdvancedExerciseStrategy, FoundationalExerciseStrategy } from "./strategies/index.js";
import { ProgressionCatalog } from "./advanced/index.js";
import { advancedExercisePluginDescriptor, defaultExercisePluginDescriptor, exerciseServiceDescriptors, exerciseStrategyDescriptors } from "./descriptors.js";
import { exercisePackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) { const errors = []; for (const undo of [...actions].reverse()) { try { undo(); } catch (error) { errors.push(error); } } return errors; }

function strategyContract(strategy, id, pluginId, option) {
    if (!strategy || String(strategy.id) !== id || String(strategy.pluginId) !== pluginId) {
        throw new ValidationError(`ExerciseModule ${option} must belong to ${pluginId} with id ${id}.`);
    }
    return strategy;
}

export class ExerciseModule {
    #configured = false;
    #ownedStrategyRegistrations = new Set();
    #undo = [];
    #injectedStrategy;
    #injectedScaleGenerator;
    #injectedChordGenerator;
    #injectedAdvancedStrategy;
    #injectedProgressionCatalog;

    constructor(options = {}) {
        this.id = String(exercisePackageDescriptor.id);
        this.descriptor = exercisePackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new ExerciseStrategyRegistry();
        this.engine = options.engine ?? new ExerciseEngine(this.strategyRegistry);
        this.#injectedStrategy = options.foundationalStrategy === undefined ? null : strategyContract(options.foundationalStrategy, "foundational", "core.exercise.foundational", "foundationalStrategy");
        this.#injectedAdvancedStrategy = options.advancedStrategy === undefined ? null : strategyContract(options.advancedStrategy, "advanced", "core.exercise.advanced", "advancedStrategy");
        this.#injectedProgressionCatalog = options.progressionCatalog ?? null;
        if (this.#injectedProgressionCatalog && !this.#injectedProgressionCatalog.get) throw new ValidationError("ExerciseModule progressionCatalog must provide get().");
        this.#injectedScaleGenerator = options.scaleGenerator ?? null;
        this.#injectedChordGenerator = options.chordGenerator ?? null;
        if (this.#injectedStrategy && (this.#injectedScaleGenerator || this.#injectedChordGenerator)) {
            throw new ValidationError("Provide either foundationalStrategy or Theory generators to ExerciseModule, not both.");
        }
        this.foundationalStrategy = this.#injectedStrategy;
        this.advancedStrategy = this.#injectedAdvancedStrategy;
        this.progressionCatalog = this.#injectedProgressionCatalog;
        this.plugin = this.#injectedStrategy ? this.#pluginFor(this.#injectedStrategy) : null;
        this.advancedPlugin = this.#injectedAdvancedStrategy ? this.#advancedPluginFor(this.#injectedAdvancedStrategy) : null;
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const strategy = this.#resolveStrategy(services);
        const activeProgressionCatalog = services.resolve("exercise.progressionCatalog", { optional: true });
        const progressionCatalog = this.#injectedProgressionCatalog ?? activeProgressionCatalog ?? new ProgressionCatalog();
        const advancedStrategy = this.#resolveAdvancedStrategy(services, progressionCatalog, strategy);
        const plugin = this.#injectedStrategy ? this.plugin : this.#pluginFor(strategy);
        const advancedPlugin = this.#injectedAdvancedStrategy ? this.advancedPlugin : this.#advancedPluginFor(advancedStrategy);
        const undo = [];
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => { if (services.resolve(id, { optional: true }) === value) services.unregister(id); });
        };
        const ensureStrategy = currentStrategy => {
            const existing = this.strategyRegistry.get(currentStrategy.pluginId, currentStrategy.id);
            if (existing === currentStrategy) return;
            this.strategyRegistry.register(currentStrategy.pluginId, currentStrategy);
            const key = `${currentStrategy.pluginId}:${currentStrategy.id}`;
            this.#ownedStrategyRegistrations.add(key);
            undo.push(() => {
                if (this.strategyRegistry.get(currentStrategy.pluginId, currentStrategy.id) === currentStrategy) this.strategyRegistry.unregister(currentStrategy.pluginId, currentStrategy.id);
                this.#ownedStrategyRegistrations.delete(key);
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
            ensureStrategy(strategy);
            ensureStrategy(advancedStrategy);
            registerService("exercise.engine", this.engine);
            registerService("exercise.strategyRegistry", this.strategyRegistry);
            if (this.#injectedProgressionCatalog || activeProgressionCatalog !== progressionCatalog) registerService("exercise.progressionCatalog", progressionCatalog);
            registerValue(registries.services, exerciseServiceDescriptors.engine, this.engine);
            registerValue(registries.services, exerciseServiceDescriptors.strategies, this.strategyRegistry);
            registerValue(registries.services, exerciseServiceDescriptors.progressions, progressionCatalog);
            registerValue(registries.plugins, defaultExercisePluginDescriptor, plugin);
            registerValue(registries.plugins, advancedExercisePluginDescriptor, advancedPlugin);
            registerValue(registries.exercises, exerciseStrategyDescriptors.foundational, strategy);
            registerValue(registries.exercises, exerciseStrategyDescriptors.advanced, advancedStrategy);
            this.foundationalStrategy = strategy;
            this.advancedStrategy = advancedStrategy;
            this.progressionCatalog = progressionCatalog;
            this.plugin = plugin;
            this.advancedPlugin = advancedPlugin;
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollback = runUndo(undo);
            if (rollback.length) throw new AggregateError([error, ...rollback], "ExerciseModule configuration and rollback failed.", { cause: error });
            throw error;
        }
    }

    dispose() {
        const strategies = [this.foundationalStrategy, this.advancedStrategy].filter(Boolean);
        const undo = this.#undo; this.#undo = []; this.#configured = false;
        const errors = runUndo(undo);
        try {
            for (const strategy of strategies) {
                const key = `${strategy.pluginId}:${strategy.id}`;
                if (this.#ownedStrategyRegistrations.has(key) && this.strategyRegistry.get(strategy.pluginId, strategy.id) === strategy) this.strategyRegistry.unregister(strategy.pluginId, strategy.id);
                this.#ownedStrategyRegistrations.delete(key);
            }
        } catch (error) { errors.push(error); }
        if (!this.#injectedStrategy) { this.foundationalStrategy = null; this.plugin = null; }
        if (!this.#injectedAdvancedStrategy) { this.advancedStrategy = null; this.advancedPlugin = null; }
        if (!this.#injectedProgressionCatalog) this.progressionCatalog = null;
        if (errors.length) throw new AggregateError(errors, "ExerciseModule disposal failed.");
        return this;
    }

    #resolveStrategy(services) {
        if (this.#injectedStrategy) return this.#injectedStrategy;
        let scaleGenerator = this.#injectedScaleGenerator;
        let chordGenerator = this.#injectedChordGenerator;
        try {
            scaleGenerator ??= services.resolve("theory.scaleGenerator");
            chordGenerator ??= services.resolve("theory.chordGenerator");
        } catch (cause) {
            throw new ValidationError("ExerciseModule requires active theory.scaleGenerator and theory.chordGenerator services.", { cause });
        }
        return new FoundationalExerciseStrategy({ scaleGenerator, chordGenerator });
    }

    #resolveAdvancedStrategy(services, progressionCatalog, foundationalStrategy) {
        if (this.#injectedAdvancedStrategy) return this.#injectedAdvancedStrategy;
        let scaleGenerator = this.#injectedScaleGenerator ?? foundationalStrategy?.scaleGenerator;
        let chordGenerator = this.#injectedChordGenerator ?? foundationalStrategy?.chordGenerator;
        try {
            scaleGenerator ??= services.resolve("theory.scaleGenerator");
            chordGenerator ??= services.resolve("theory.chordGenerator");
        } catch (cause) {
            throw new ValidationError("ExerciseModule requires active theory.scaleGenerator and theory.chordGenerator services.", { cause });
        }
        return new AdvancedExerciseStrategy({ scaleGenerator, chordGenerator, progressionCatalog });
    }

    #pluginFor(strategy) { return Object.freeze({ id: String(defaultExercisePluginDescriptor.id), strategies: Object.freeze([strategy]) }); }
    #advancedPluginFor(strategy) { return Object.freeze({ id: String(advancedExercisePluginDescriptor.id), strategies: Object.freeze([strategy]) }); }
}

export default ExerciseModule;
