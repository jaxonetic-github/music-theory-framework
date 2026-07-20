import { ValidationError } from "../Foundation/index.js";
import { ExerciseEngine } from "./ExerciseEngine.js";
import { ExerciseStrategyRegistry } from "./ExerciseStrategyRegistry.js";
import { FoundationalExerciseStrategy } from "./strategies/index.js";
import { defaultExercisePluginDescriptor, exerciseServiceDescriptors, exerciseStrategyDescriptors } from "./descriptors.js";
import { exercisePackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) { const errors = []; for (const undo of [...actions].reverse()) { try { undo(); } catch (error) { errors.push(error); } } return errors; }

function strategyContract(strategy) {
    if (!strategy || String(strategy.id) !== "foundational" || String(strategy.pluginId) !== "core.exercise.foundational") {
        throw new ValidationError("ExerciseModule foundationalStrategy must belong to core.exercise.foundational with id foundational.");
    }
    return strategy;
}

export class ExerciseModule {
    #configured = false;
    #ownsStrategyRegistration = false;
    #undo = [];
    #injectedStrategy;
    #injectedScaleGenerator;
    #injectedChordGenerator;

    constructor(options = {}) {
        this.id = String(exercisePackageDescriptor.id);
        this.descriptor = exercisePackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new ExerciseStrategyRegistry();
        this.engine = options.engine ?? new ExerciseEngine(this.strategyRegistry);
        this.#injectedStrategy = options.foundationalStrategy === undefined ? null : strategyContract(options.foundationalStrategy);
        this.#injectedScaleGenerator = options.scaleGenerator ?? null;
        this.#injectedChordGenerator = options.chordGenerator ?? null;
        if (this.#injectedStrategy && (this.#injectedScaleGenerator || this.#injectedChordGenerator)) {
            throw new ValidationError("Provide either foundationalStrategy or Theory generators to ExerciseModule, not both.");
        }
        this.foundationalStrategy = this.#injectedStrategy;
        this.plugin = this.#injectedStrategy ? this.#pluginFor(this.#injectedStrategy) : null;
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
        const strategy = this.#resolveStrategy(services);
        const plugin = this.#pluginFor(strategy);
        const undo = [];
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => { if (services.resolve(id, { optional: true }) === value) services.unregister(id); });
        };
        const ensureStrategy = () => {
            const existing = this.strategyRegistry.get(strategy.pluginId, strategy.id);
            if (existing === strategy) return;
            this.strategyRegistry.register(strategy.pluginId, strategy);
            this.#ownsStrategyRegistration = true;
            undo.push(() => {
                if (this.strategyRegistry.get(strategy.pluginId, strategy.id) === strategy) this.strategyRegistry.unregister(strategy.pluginId, strategy.id);
                this.#ownsStrategyRegistration = false;
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
            registerValue(registries.plugins, defaultExercisePluginDescriptor, plugin);
            registerValue(registries.exercises, exerciseStrategyDescriptors.foundational, strategy);
            this.foundationalStrategy = strategy;
            this.plugin = plugin;
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
        const strategy = this.foundationalStrategy;
        const undo = this.#undo; this.#undo = []; this.#configured = false;
        const errors = runUndo(undo);
        try {
            if (strategy && this.#ownsStrategyRegistration && this.strategyRegistry.get(strategy.pluginId, strategy.id) === strategy) {
                this.strategyRegistry.unregister(strategy.pluginId, strategy.id);
            }
            this.#ownsStrategyRegistration = false;
        } catch (error) { errors.push(error); }
        if (!this.#injectedStrategy) { this.foundationalStrategy = null; this.plugin = null; }
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

    #pluginFor(strategy) { return Object.freeze({ id: String(defaultExercisePluginDescriptor.id), strategies: Object.freeze([strategy]) }); }
}

export default ExerciseModule;
