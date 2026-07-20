import { Identifier, StrategyContract } from "../../Foundation/index.js";

export class ExerciseStrategy extends StrategyContract {
    constructor({ id, pluginId } = {}) {
        super();
        Object.defineProperties(this, {
            id: { value: Identifier.from(id), enumerable: true },
            pluginId: { value: Identifier.from(pluginId), enumerable: true }
        });
    }
    supports() { return false; }
    generate() { throw new Error("ExerciseStrategy.generate() must be implemented."); }
    execute(request) { return this.generate(request); }
}

export default ExerciseStrategy;
