import { ApplicationRequest } from "../core/index.js";

function firstId(values, label) {
    const id = values?.[0]?.id;
    if (!id) throw new Error(`The ${label} catalog is empty.`);
    return String(id);
}

export function createInitialWorkflowState(catalogs) {
    return Object.freeze({
        type: "scale",
        root: "C",
        pattern: firstId(catalogs.scales, "scale"),
        octave: 4,
        renderingEnabled: true,
        exportEnabled: false
    });
}

export function transitionWorkflow(state, change, catalogs) {
    if (!change || typeof change !== "object") throw new TypeError("A workflow change must be an object.");
    if (change.type === "chord" && state.type !== "chord") {
        return Object.freeze({
            type: "chord", root: state.root, quality: firstId(catalogs.chords, "chord"), octave: state.octave,
            renderingEnabled: state.renderingEnabled, exportEnabled: state.exportEnabled
        });
    }
    if (change.type === "scale" && state.type !== "scale") {
        return Object.freeze({
            type: "scale", root: state.root, pattern: firstId(catalogs.scales, "scale"), octave: state.octave,
            renderingEnabled: state.renderingEnabled, exportEnabled: state.exportEnabled
        });
    }
    const next = { ...state, ...change };
    delete next[state.type === "scale" ? "quality" : "pattern"];
    return Object.freeze(next);
}

export function buildWorkflowRequest(state) {
    const common = {
        type: state.type,
        root: String(state.root).trim(),
        notationOptions: { octave: Number(state.octave) },
        ...(state.renderingEnabled ? { rendering: { format: "svg" } } : {}),
        ...(state.exportEnabled ? { export: { format: "musicxml" } } : {})
    };
    return new ApplicationRequest(state.type === "scale"
        ? { ...common, pattern: state.pattern }
        : { ...common, quality: state.quality });
}

export function workflowTitle(result) {
    return result ? String(result.generation.model) : "";
}

export function workflowPitches(result) {
    return result ? Object.freeze(result.generation.model.pitchClasses.map(String)) : Object.freeze([]);
}
