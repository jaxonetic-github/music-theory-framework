import { ExerciseSetRequest, freezeDeep } from "../../core/index.js";
import { buildExerciseApplicationRequest, createInitialExercisePracticeState, transitionExercisePracticeState } from "../exercise/workflow.js";

const frozen = value => freezeDeep(value);
function item(id, catalogs, controls = null, label = "") { return frozen({ id, label, controls: controls ?? createInitialExercisePracticeState(catalogs) }); }
export function createInitialExerciseSetState(catalogs) { return frozen({ title: "Practice Worksheet", subtitle: "", instructions: "", nextSection: 2, nextItem: 2, sections: [{ id: "worksheet-section-1", title: "Section 1", label: "", items: [item("worksheet-item-1", catalogs)] }] }); }
function locate(sections, id) { const index = sections.findIndex(value => value.id === id); if (index < 0) throw new TypeError(`Unknown worksheet section: ${id}.`); return index; }
export function transitionExerciseSetState(state, action, catalogs) {
    if (!action || typeof action !== "object") throw new TypeError("Worksheet action must be an object.");
    if (action.type === "reset") return createInitialExerciseSetState(catalogs);
    let sections = state.sections.map(section => ({ ...section, items: section.items.map(value => ({ ...value })) })); let nextSection = state.nextSection, nextItem = state.nextItem;
    if (action.type === "metadata") { if (Object.entries(action.change ?? {}).every(([key, value]) => Object.is(state[key], value))) return state; return frozen({ ...state, ...action.change }); }
    if (action.type === "add-section") { const id = `worksheet-section-${nextSection++}`; sections.push({ id, title: `Section ${sections.length + 1}`, label: "", items: [item(`worksheet-item-${nextItem++}`, catalogs)] }); }
    else if (action.type === "remove-section") sections.splice(locate(sections, action.sectionId), 1);
    else if (action.type === "edit-section") { const index = locate(sections, action.sectionId); sections[index] = { ...sections[index], ...action.change };
    } else if (["move-section-up", "move-section-down"].includes(action.type)) { const index = locate(sections, action.sectionId), target = index + (action.type.endsWith("up") ? -1 : 1); if (target < 0 || target >= sections.length) return state; [sections[index], sections[target]] = [sections[target], sections[index]];
    } else {
        const sectionIndex = locate(sections, action.sectionId), section = sections[sectionIndex], itemIndex = section.items.findIndex(value => value.id === action.itemId);
        if (action.type === "add-item") section.items.push(item(`worksheet-item-${nextItem++}`, catalogs));
        else if (itemIndex < 0) throw new TypeError(`Unknown worksheet item: ${action.itemId}.`);
        else if (action.type === "remove-item") section.items.splice(itemIndex, 1);
        else if (action.type === "duplicate-item") { const source = section.items[itemIndex]; section.items.splice(itemIndex + 1, 0, item(`worksheet-item-${nextItem++}`, catalogs, { ...source.controls }, source.label ? `${source.label} copy` : "")); }
        else if (action.type === "edit-item") section.items[itemIndex] = { ...section.items[itemIndex], ...action.change };
        else if (action.type === "edit-controls") section.items[itemIndex] = { ...section.items[itemIndex], controls: transitionExercisePracticeState(section.items[itemIndex].controls, action.change, catalogs) };
        else if (["move-item-up", "move-item-down"].includes(action.type)) { const target = itemIndex + (action.type.endsWith("up") ? -1 : 1); if (target < 0 || target >= section.items.length) return state; [section.items[itemIndex], section.items[target]] = [section.items[target], section.items[itemIndex]]; }
        else throw new TypeError(`Unknown worksheet action: ${action.type}.`);
    }
    return frozen({ ...state, sections, nextSection, nextItem });
}
export function buildExerciseSetRequest(state, catalogs) { return new ExerciseSetRequest({ title: state.title, subtitle: state.subtitle || undefined, instructions: state.instructions || undefined, sections: state.sections.map((section, sectionIndex) => ({ id: section.id, title: section.title, label: section.label || undefined, order: sectionIndex + 1, items: section.items.map((value, itemIndex) => ({ id: value.id, label: value.label || undefined, order: itemIndex + 1, application: buildExerciseApplicationRequest(value.controls, catalogs) })) })) }); }
