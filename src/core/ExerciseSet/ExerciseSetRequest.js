import { canonicalSerialize, Identifier, ValidationError } from "../Foundation/index.js";
import { ExerciseSetItemRequest } from "./ExerciseSetItemRequest.js";
import { EXERCISE_SET_LIMITS } from "./limits.js";

const requestKeys = new Set(["id", "title", "subtitle", "instructions", "sections"]), sectionKeys = new Set(["id", "title", "label", "order", "items"]);
function text(value, label, { required = false, max = EXERCISE_SET_LIMITS.textLength } = {}) {
    if (value === undefined || value === null) { if (required) throw new ValidationError(`${label} is required.`); return null; }
    const result = String(value).trim(); if (!result || result.length > max) throw new ValidationError(`${label} must be a non-empty string of at most ${max} characters.`); return result;
}
function rejectUnknown(value, allowed, label) { const unknown = Object.keys(value).filter(key => !allowed.has(key)); if (unknown.length) throw new ValidationError(`Unknown ${label} option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`); }
function identifier(value, label, fallback) { if (value === undefined || value === null) return fallback; try { const id = String(Identifier.from(value)); if (id.length > EXERCISE_SET_LIMITS.labelLength) throw new Error(`identifier exceeds ${EXERCISE_SET_LIMITS.labelLength} characters`); return id; } catch (cause) { throw new ValidationError(`Invalid ${label}: ${cause.message}`, { cause }); } }
function token(value) { return String(value).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "worksheet"; }
export class ExerciseSetRequest {
    constructor(value = {}) {
        if (value instanceof ExerciseSetRequest) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Exercise set request must be an object."); rejectUnknown(value, requestKeys, "exercise set request");
        const title = text(value.title, "Exercise set title", { required: true, max: EXERCISE_SET_LIMITS.titleLength });
        if (!Array.isArray(value.sections) || value.sections.length < 1) throw new ValidationError("Exercise set requires at least one section.");
        if (value.sections.length > EXERCISE_SET_LIMITS.sections) throw new ValidationError(`Exercise set supports at most ${EXERCISE_SET_LIMITS.sections} sections.`);
        const sectionIds = new Set(), itemIds = new Set(); let total = 0;
        const sections = value.sections.map((source, index) => {
            const sequence = index + 1;
            if (!source || typeof source !== "object" || Array.isArray(source)) throw new ValidationError(`Section ${sequence} must be an object.`); rejectUnknown(source, sectionKeys, `section ${sequence}`);
            if (source.order !== undefined && (!Number.isSafeInteger(source.order) || source.order !== sequence)) throw new ValidationError(`Section ${sequence} order must match its position (${sequence}).`);
            const sectionTitle = text(source.title, `Section ${sequence} title`, { required: true, max: EXERCISE_SET_LIMITS.titleLength });
            const id = identifier(source.id, `section ${sequence} id`, `section:${sequence}`);
            if (sectionIds.has(id)) throw new ValidationError(`Duplicate exercise set section identity: "${id}".`); sectionIds.add(id);
            if (!Array.isArray(source.items) || source.items.length < 1) throw new ValidationError(`Section "${id}" requires at least one exercise item.`);
            if (source.items.length > EXERCISE_SET_LIMITS.itemsPerSection) throw new ValidationError(`Section "${id}" supports at most ${EXERCISE_SET_LIMITS.itemsPerSection} items.`);
            const items = source.items.map((item, itemIndex) => { try { const normalized = new ExerciseSetItemRequest(item, { sectionId: id, sequence: itemIndex + 1 }); if (itemIds.has(normalized.id)) throw new ValidationError(`Duplicate exercise set item identity: "${normalized.id}".`); itemIds.add(normalized.id); return normalized; } catch (cause) { throw new ValidationError(`Invalid item ${itemIndex + 1} in section "${id}": ${cause.message}`, { cause }); } });
            total += items.length; return Object.freeze({ id, title: sectionTitle, label: text(source.label, `Section "${id}" label`, { max: EXERCISE_SET_LIMITS.labelLength }), sequence, items: Object.freeze(items) });
        });
        if (total > EXERCISE_SET_LIMITS.totalItems) throw new ValidationError(`Exercise set supports at most ${EXERCISE_SET_LIMITS.totalItems} total items.`);
        const signature = { title, subtitle: text(value.subtitle, "Exercise set subtitle"), instructions: text(value.instructions, "Exercise set instructions"), sections: sections.map(section => ({ id: section.id, title: section.title, label: section.label, sequence: section.sequence, items: section.items.map(item => ({ id: item.id, label: item.label, sequence: item.sequence, application: item.application.identity })) })) };
        const serialized = canonicalSerialize(signature), id = identifier(value.id, "exercise set id", `exercise-set:${token(title)}`), identity = `exercise-set-request:${id}:${serialized}`;
        Object.defineProperties(this, { id: { value: id, enumerable: true }, identity: { value: identity, enumerable: true }, title: { value: title, enumerable: true }, subtitle: { value: signature.subtitle, enumerable: true }, instructions: { value: signature.instructions, enumerable: true }, sections: { value: Object.freeze(sections), enumerable: true }, items: { value: Object.freeze(sections.flatMap(section => section.items)), enumerable: true } }); Object.freeze(this);
    }
    static from(value) { return value instanceof ExerciseSetRequest ? value : new ExerciseSetRequest(value); }
}
export default ExerciseSetRequest;
