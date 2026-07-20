import { ValidationError } from "../Foundation/index.js";
import { ExerciseApplicationEngine } from "./ExerciseApplicationEngine.js";
import { exerciseApplicationPluginDescriptor, exerciseApplicationServiceDescriptor, exerciseApplicationWorkflowDescriptor } from "./descriptors.js";
import { exerciseApplicationPackageDescriptor } from "./package.descriptor.js";
function runUndo(actions) { const errors = []; for (const action of [...actions].reverse()) try { action(); } catch (error) { errors.push(error); } return errors; }
export class ExerciseApplicationModule {
    #configured = false; #undo = []; #injectedEngine; #injectedExercise; #injectedNotation; #injectedRendering;
    constructor({ engine = null, exerciseEngine = null, notationEngine = null, renderingEngine = null } = {}) {
        if (engine && (exerciseEngine || notationEngine || renderingEngine)) throw new ValidationError("ExerciseApplicationModule accepts either engine or injected stage services, not both.");
        this.id = String(exerciseApplicationPackageDescriptor.id); this.descriptor = exerciseApplicationPackageDescriptor;
        this.#injectedEngine = engine; this.#injectedExercise = exerciseEngine; this.#injectedNotation = notationEngine; this.#injectedRendering = renderingEngine;
        this.engine = engine; this.plugin = null; Object.seal(this);
    }
    configure({ services, registries }) {
        if (this.#configured) return this;
        let engine;
        try { engine = this.#injectedEngine ?? new ExerciseApplicationEngine({ exerciseEngine: this.#injectedExercise ?? services.resolve("exercise.engine"), notationEngine: this.#injectedNotation ?? services.resolve("exercise.notation.engine"), renderingEngine: this.#injectedRendering ?? services.resolve("rendering.engine") }); }
        catch (cause) { throw new ValidationError("ExerciseApplicationModule requires active exercise.engine, exercise.notation.engine, and rendering.engine services.", { cause }); }
        if (!engine || typeof engine.run !== "function") throw new ValidationError("ExerciseApplicationModule engine must implement run().");
        const plugin = Object.freeze({ id: String(exerciseApplicationPluginDescriptor.id), workflows: Object.freeze([engine]) }); const undo = [];
        const registerService = (id, value) => { services.register(id, value); undo.push(() => { if (services.resolve(id, { optional: true }) === value) services.unregister(id); }); };
        const registerValue = (target, descriptor, value) => { const previous = target.getRecord(descriptor.id); let record = null; const remove = current => { if (target.getRecord(descriptor.id) === current) target.unregister(descriptor.id); }; try { record = target.register(descriptor, { value }); } catch (error) { const current = target.getRecord(descriptor.id); if (!previous && current?.descriptor === descriptor && current?.value === value) try { remove(current); } catch {} throw error; } undo.push(() => remove(record)); };
        try { registerService("exercise.application.engine", engine); registerValue(registries.services, exerciseApplicationServiceDescriptor, engine); registerValue(registries.plugins, exerciseApplicationPluginDescriptor, plugin); registerValue(registries.exercises, exerciseApplicationWorkflowDescriptor, engine); this.engine = engine; this.plugin = plugin; this.#undo = undo; this.#configured = true; return this; }
        catch (error) { const rollback = runUndo(undo); if (rollback.length) throw new AggregateError([error, ...rollback], "ExerciseApplicationModule configuration and rollback failed.", { cause: error }); throw error; }
    }
    dispose() { const errors = runUndo(this.#undo); this.#undo = []; this.#configured = false; if (!this.#injectedEngine) this.engine = null; this.plugin = null; if (errors.length) throw new AggregateError(errors, "ExerciseApplicationModule disposal failed."); return this; }
}
export default ExerciseApplicationModule;
