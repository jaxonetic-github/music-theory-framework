import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseNotationRequest } from "./ExerciseNotationRequest.js";
import { ExerciseNotationSection } from "./ExerciseNotationSection.js";
export class ExerciseNotationDocument {
    constructor({ id, request, sections = [], metadata = {} } = {}) {
        const normalized = ExerciseNotationRequest.from(request);
        if (!String(id ?? "").trim() || !Array.isArray(sections) || sections.length === 0 || sections.some(value => !(value instanceof ExerciseNotationSection))) throw new ValidationError("Invalid exercise notation document.");
        if (new Set(sections.map(value => value.id)).size !== sections.length) throw new ValidationError("Duplicate exercise notation section identity.");
        const rows = sections.flatMap(value => value.rows); if (new Set(rows.map(value => value.id)).size !== rows.length) throw new ValidationError("Duplicate exercise notation row identity across sections.");
        Object.defineProperties(this, { id: { value: String(id), enumerable: true }, request: { value: normalized, enumerable: true }, model: { value: normalized.model, enumerable: true }, sections: { value: Object.freeze([...sections]), enumerable: true }, rows: { value: Object.freeze(rows), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
