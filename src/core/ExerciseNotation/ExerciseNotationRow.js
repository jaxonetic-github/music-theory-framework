import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseRow } from "../Exercise/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { ExerciseNotationSystem } from "./ExerciseNotationSystem.js";
export class ExerciseNotationRow {
    constructor({ id, sourceRow, graph, systems = [], measureCount, eventCount, finalMeasureComplete, metadata = {} } = {}) {
        if (!String(id ?? "").trim() || !(sourceRow instanceof ExerciseRow) || !(graph instanceof ScoreGraph)) throw new ValidationError("Exercise notation rows require id, source ExerciseRow, and ScoreGraph.");
        if (!Array.isArray(systems) || systems.some(value => !(value instanceof ExerciseNotationSystem))) throw new ValidationError("Exercise notation row systems are invalid.");
        const graphMeasures = graph.nodesOfType("measure").map(node => String(node.id)); const grouped = systems.flatMap(value => value.measureIds);
        if (grouped.length !== graphMeasures.length || new Set(grouped).size !== grouped.length || graphMeasures.some(id => !grouped.includes(id))) throw new ValidationError("Every row measure must occur in exactly one notation system.");
        if (!Number.isSafeInteger(measureCount) || measureCount !== graphMeasures.length || !Number.isSafeInteger(eventCount) || eventCount < 1 || typeof finalMeasureComplete !== "boolean") throw new ValidationError("Exercise notation row counts are invalid.");
        Object.defineProperties(this, {
            id: { value: String(id), enumerable: true }, sourceRow: { value: sourceRow, enumerable: true }, graph: { value: graph, enumerable: true }, systems: { value: Object.freeze([...systems]), enumerable: true },
            title: { value: sourceRow.title, enumerable: true }, subtitle: { value: sourceRow.subtitle, enumerable: true }, root: { value: sourceRow.root, enumerable: true }, type: { value: sourceRow.type, enumerable: true }, pattern: { value: sourceRow.pattern, enumerable: true }, quality: { value: sourceRow.quality, enumerable: true }, direction: { value: sourceRow.direction, enumerable: true }, octaves: { value: sourceRow.octaves, enumerable: true }, startingOctave: { value: sourceRow.startingOctave, enumerable: true },
            measureCount: { value: measureCount, enumerable: true }, eventCount: { value: eventCount, enumerable: true }, finalMeasureComplete: { value: finalMeasureComplete, enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true }
        }); Object.freeze(this);
    }
}
