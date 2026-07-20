import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseModel } from "../Exercise/index.js";
import { ExerciseNotationDocument } from "../ExerciseNotation/index.js";
import { ExerciseApplicationRequest } from "./ExerciseApplicationRequest.js";
import { ExercisePresentationSection } from "./ExercisePresentationSection.js";
export class ExercisePresentationDocument {
    constructor({ id, request, model, notationDocument, sections, metadata = {} } = {}) {
        if (!String(id ?? "").trim() || !(request instanceof ExerciseApplicationRequest) || !(model instanceof ExerciseModel) || !(notationDocument instanceof ExerciseNotationDocument) || notationDocument.model !== model || !Array.isArray(sections) || sections.length !== notationDocument.sections.length || sections.some((section, index) => !(section instanceof ExercisePresentationSection) || section.notationSection !== notationDocument.sections[index])) throw new ValidationError("Invalid exercise presentation document.");
        if (new Set(sections.map(section => section.id)).size !== sections.length) throw new ValidationError("Duplicate exercise presentation section identity.");
        const rows = sections.flatMap(section => section.rows); if (new Set(rows.map(row => row.id)).size !== rows.length) throw new ValidationError("Duplicate exercise presentation row identity across sections.");
        Object.defineProperties(this, { id: { value: String(id), enumerable: true }, request: { value: request, enumerable: true }, model: { value: model, enumerable: true }, notationDocument: { value: notationDocument, enumerable: true }, sections: { value: Object.freeze([...sections]), enumerable: true }, rows: { value: Object.freeze(rows), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true } }); Object.freeze(this);
    }
}
export default ExercisePresentationDocument;
