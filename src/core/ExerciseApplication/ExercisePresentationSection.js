import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseNotationSection } from "../ExerciseNotation/index.js";
import { ExercisePresentationRow } from "./ExercisePresentationRow.js";
export class ExercisePresentationSection {
    constructor({ id, sourceSection, notationSection, sequence, rows, metadata = {} } = {}) {
        if (!String(id ?? "").trim() || !(notationSection instanceof ExerciseNotationSection) || sourceSection !== notationSection.sourceSection || sequence !== notationSection.sequence || !Array.isArray(rows) || rows.length !== notationSection.rows.length || rows.some((row, index) => !(row instanceof ExercisePresentationRow) || row.notationRow !== notationSection.rows[index])) throw new ValidationError("Invalid exercise presentation section.");
        if (new Set(rows.map(row => row.id)).size !== rows.length) throw new ValidationError("Duplicate exercise presentation row identity.");
        Object.defineProperties(this, { id: { value: String(id), enumerable: true }, sourceSection: { value: sourceSection, enumerable: true }, notationSection: { value: notationSection, enumerable: true }, title: { value: sourceSection.title, enumerable: true }, sequence: { value: sequence, enumerable: true }, rows: { value: Object.freeze([...rows]), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
export default ExercisePresentationSection;
