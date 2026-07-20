import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseRow } from "./ExerciseRow.js";

export class ExerciseSection {
    constructor({ id, title, sequence, rows = [], metadata = {} } = {}) {
        const normalizedId = String(id ?? "").trim();
        const normalizedTitle = String(title ?? "").trim();
        if (!normalizedId || !normalizedTitle) throw new ValidationError("Exercise sections require id and title.");
        if (!Number.isSafeInteger(sequence) || sequence < 1) throw new ValidationError("Exercise section sequence must be a positive safe integer.");
        if (!Array.isArray(rows) || rows.length === 0 || rows.some(row => !(row instanceof ExerciseRow))) throw new ValidationError("Exercise sections require ExerciseRow values.");
        const ids = new Set();
        for (const row of rows) {
            if (ids.has(row.id)) throw new ValidationError(`Duplicate exercise row id: "${row.id}".`);
            ids.add(row.id);
        }
        Object.defineProperties(this, {
            id: { value: normalizedId, enumerable: true }, title: { value: normalizedTitle, enumerable: true },
            sequence: { value: sequence, enumerable: true }, rows: { value: Object.freeze([...rows]), enumerable: true },
            metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true }
        });
        Object.freeze(this);
    }
}

export default ExerciseSection;
