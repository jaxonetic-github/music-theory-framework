import { ValidationError } from "../Foundation/index.js";
import { ExerciseNotationEngine } from "./ExerciseNotationEngine.js";
import { ExerciseRowNotationStrategy } from "./ExerciseRowNotationStrategy.js";
import { exerciseNotationDescriptor, exerciseNotationPluginDescriptor, exerciseNotationServiceDescriptor } from "./descriptors.js";
import { exerciseNotationPackageDescriptor } from "./package.descriptor.js";
function runUndo(actions) { const errors = []; for (const action of [...actions].reverse()) try { action(); } catch (error) { errors.push(error); } return errors; }
export class ExerciseNotationModule {
    #configured = false; #undo = []; #injectedRegistry; #injectedStrategy; #injectedEngine;
    constructor({ strategyRegistry = null, strategy = null, engine = null } = {}) {
        this.id = String(exerciseNotationPackageDescriptor.id); this.descriptor = exerciseNotationPackageDescriptor;
        this.#injectedRegistry = strategyRegistry; this.#injectedStrategy = strategy; this.#injectedEngine = engine;
        this.strategyRegistry = strategyRegistry; this.strategy = strategy ?? new ExerciseRowNotationStrategy(); this.engine = engine; this.plugin = Object.freeze({ id: String(exerciseNotationPluginDescriptor.id), strategies: Object.freeze([this.strategy]) }); Object.seal(this);
    }
    configure({ services, registries }) {
        if (this.#configured) return this;
        let registry;
        try { registry = this.#injectedRegistry ?? services.resolve("notation.strategyRegistry"); }
        catch (cause) { throw new ValidationError("ExerciseNotationModule requires the active notation.strategyRegistry service.", { cause }); }
        if (!registry || typeof registry.register !== "function" || typeof registry.select !== "function") throw new ValidationError("ExerciseNotationModule requires a valid NotationStrategyRegistry.");
        const engine = this.#injectedEngine ?? new ExerciseNotationEngine(registry);
        if (engine.registry !== registry) throw new ValidationError("ExerciseNotationModule engine must use the selected notation strategy registry.");
        const strategy = this.#injectedStrategy ?? this.strategy; const plugin = this.plugin; const undo = [];
        const registerService = (id, value) => { services.register(id, value); undo.push(() => { if (services.resolve(id, { optional: true }) === value) services.unregister(id); }); };
        const registerValue = (target, descriptor, value) => { const previous = target.getRecord(descriptor.id); let record = null; const remove = current => { if (target.getRecord(descriptor.id) === current) target.unregister(descriptor.id); }; try { record = target.register(descriptor, { value }); } catch (error) { const current = target.getRecord(descriptor.id); if (!previous && current?.descriptor === descriptor && current?.value === value) try { remove(current); } catch {} throw error; } undo.push(() => remove(record)); };
        try {
            const existing = registry.get(strategy.pluginId, strategy.id);
            if (existing !== strategy) { registry.register(strategy.pluginId, strategy); undo.push(() => { if (registry.get(strategy.pluginId, strategy.id) === strategy) registry.unregister(strategy.pluginId, strategy.id); }); }
            registerService("exercise.notation.engine", engine); registerValue(registries.services, exerciseNotationServiceDescriptor, engine); registerValue(registries.plugins, exerciseNotationPluginDescriptor, plugin); registerValue(registries.exercises, exerciseNotationDescriptor, strategy);
            this.strategyRegistry = registry; this.engine = engine; this.strategy = strategy; this.plugin = plugin; this.#undo = undo; this.#configured = true; return this;
        } catch (error) { const rollback = runUndo(undo); if (rollback.length) throw new AggregateError([error, ...rollback], "ExerciseNotationModule configuration and rollback failed.", { cause: error }); throw error; }
    }
    dispose() { const errors = runUndo(this.#undo); this.#undo = []; this.#configured = false; if (!this.#injectedRegistry) this.strategyRegistry = null; if (!this.#injectedEngine) this.engine = null; if (errors.length) throw new AggregateError(errors, "ExerciseNotationModule disposal failed."); return this; }
}
