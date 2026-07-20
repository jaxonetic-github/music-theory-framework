import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseSection } from "../Exercise/index.js";
import { ExerciseNotationRow } from "./ExerciseNotationRow.js";
export class ExerciseNotationSection {
    constructor({ id, sourceSection, sequence, rows = [], metadata = {} } = {}) {
        if (!String(id ?? "").trim() || !(sourceSection instanceof ExerciseSection) || !Number.isSafeInteger(sequence) || sequence < 1 || !Array.isArray(rows) || rows.length === 0 || rows.some(row => !(row instanceof ExerciseNotationRow))) throw new ValidationError("Invalid exercise notation section.");
        if (new Set(rows.map(row => row.id)).size !== rows.length) throw new ValidationError("Duplicate exercise notation row identity.");
        Object.defineProperties(this, { id: { value: String(id), enumerable: true }, sourceSection: { value: sourceSection, enumerable: true }, title: { value: sourceSection.title, enumerable: true }, sequence: { value: sequence, enumerable: true }, rows: { value: Object.freeze([...rows]), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
