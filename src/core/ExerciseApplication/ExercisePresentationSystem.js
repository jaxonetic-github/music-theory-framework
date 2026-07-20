import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseNotationSystem } from "../ExerciseNotation/index.js";
export class ExercisePresentationSystem {
    constructor({ id, sourceSystem, sequence, measureIds, metadata = {} } = {}) {
        if (!String(id ?? "").trim() || !(sourceSystem instanceof ExerciseNotationSystem) || sequence !== sourceSystem.sequence || !Array.isArray(measureIds) || measureIds.length !== sourceSystem.measureIds.length || measureIds.some((value, index) => String(value) !== sourceSystem.measureIds[index])) throw new ValidationError("Invalid exercise presentation system.");
        Object.defineProperties(this, { id: { value: String(id), enumerable: true }, sourceSystem: { value: sourceSystem, enumerable: true }, sequence: { value: sequence, enumerable: true }, measureIds: { value: Object.freeze(measureIds.map(String)), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
export default ExercisePresentationSystem;
