import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseNotationRow } from "../ExerciseNotation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { ExercisePresentationSystem } from "./ExercisePresentationSystem.js";
export class ExercisePresentationRow {
    constructor({ id, modelId, sectionId, sourceRow, notationRow, graph, systems, content, format, mediaType, rendererPluginId, rendererStrategyId, sequence, metadata = {} } = {}) {
        const values = [id, modelId, sectionId, format, mediaType, rendererPluginId, rendererStrategyId].map(value => String(value ?? "").trim());
        if (values.some(value => !value) || !(notationRow instanceof ExerciseNotationRow) || sourceRow !== notationRow.sourceRow || !(graph instanceof ScoreGraph) || graph !== notationRow.graph || !Number.isSafeInteger(sequence) || sequence < 1 || typeof content !== "string" || !content.trim()) throw new ValidationError("Invalid exercise presentation row.");
        if (!Array.isArray(systems) || systems.length !== notationRow.systems.length || systems.some((system, index) => !(system instanceof ExercisePresentationSystem) || system.sourceSystem !== notationRow.systems[index])) throw new ValidationError("Exercise presentation systems must preserve notation system order and identity.");
        Object.defineProperties(this, { id: { value: values[0], enumerable: true }, modelId: { value: values[1], enumerable: true }, sectionId: { value: values[2], enumerable: true }, exerciseRowId: { value: sourceRow.id, enumerable: true }, notationRowId: { value: notationRow.id, enumerable: true }, sourceRow: { value: sourceRow, enumerable: true }, notationRow: { value: notationRow, enumerable: true }, graph: { value: graph, enumerable: true }, systems: { value: Object.freeze([...systems]), enumerable: true }, title: { value: sourceRow.title, enumerable: true }, root: { value: sourceRow.root, enumerable: true }, type: { value: sourceRow.type, enumerable: true }, pattern: { value: sourceRow.pattern, enumerable: true }, quality: { value: sourceRow.quality, enumerable: true }, content: { value: content, enumerable: true }, format: { value: values[3], enumerable: true }, mediaType: { value: values[4], enumerable: true }, rendererPluginId: { value: values[5], enumerable: true }, rendererStrategyId: { value: values[6], enumerable: true }, sequence: { value: sequence, enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
export default ExercisePresentationRow;
