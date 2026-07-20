import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseRequest } from "./ExerciseRequest.js";
import { ExerciseSection } from "./ExerciseSection.js";

export class ExerciseModel {
    constructor({ id, request, sections = [], metadata = {} } = {}) {
        const normalizedId = String(id ?? "").trim();
        if (!normalizedId) throw new ValidationError("Exercise model requires a stable id.");
        const normalizedRequest = ExerciseRequest.from(request);
        if (!Array.isArray(sections) || sections.length === 0 || sections.some(section => !(section instanceof ExerciseSection))) {
            throw new ValidationError("Exercise model requires ExerciseSection values.");
        }
        const sectionIds = new Set();
        const rowIds = new Set();
        sections.forEach((section, index) => {
            if (section.sequence !== index + 1) throw new ValidationError("Exercise section sequences must be contiguous and ordered.");
            if (sectionIds.has(section.id)) throw new ValidationError(`Duplicate exercise section id: "${section.id}".`);
            sectionIds.add(section.id);
            for (const row of section.rows) {
                if (rowIds.has(row.id)) throw new ValidationError(`Duplicate exercise row id across sections: "${row.id}".`);
                rowIds.add(row.id);
            }
        });
        Object.defineProperties(this, {
            id: { value: normalizedId, enumerable: true }, request: { value: normalizedRequest, enumerable: true },
            sections: { value: Object.freeze([...sections]), enumerable: true },
            rows: { value: Object.freeze(sections.flatMap(section => section.rows)), enumerable: true },
            metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true }
        });
        Object.freeze(this);
    }
}

export default ExerciseModel;
