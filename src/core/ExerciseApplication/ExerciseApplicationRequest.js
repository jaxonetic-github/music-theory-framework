import { canonicalSerialize, cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseModel, ExerciseRequest } from "../Exercise/index.js";
import { Clef, Duration, KeySignature } from "../Notation/index.js";

const requestKeys = new Set(["exercise", "model", "notation", "rendering"]);
const notationKeys = new Set(["duration", "clef", "timeSignature", "measuresPerSystem", "keySignaturePolicy", "keySignature", "pluginId", "strategyId"]);
const renderingKeys = new Set(["format", "pluginId", "strategyId", "options"]);
const rendererOptionKeys = new Set(["width", "height", "title", "metadata"]);
const keyPolicies = new Set(["none", "explicit", "exercise-root"]);

function object(value, label, fallback = undefined) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${label} must be an object.`);
    return value;
}
function rejectUnknown(source, allowed, label) {
    const unknown = Object.keys(source).filter(key => !allowed.has(key));
    if (unknown.length) throw new ValidationError(`Unknown ${label} option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
}
function optionalId(value, label) {
    if (value === undefined || value === null) return null;
    const id = String(value).trim(); if (!id) throw new ValidationError(`${label} must be a non-empty string.`); return id;
}
function notationOptions(value) {
    const source = object(value, "Exercise notation options", {}); rejectUnknown(source, notationKeys, "exercise notation");
    const duration = Duration.from(source.duration);
    if (!Number.isSafeInteger(duration.numerator) || !Number.isSafeInteger(duration.denominator)) throw new ValidationError("Exercise notation duration values must be safe integers.");
    const clef = Clef.from(source.clef ?? "treble"); if (!["treble", "bass"].includes(clef.type)) throw new ValidationError("Exercise notation supports treble and bass clefs only.");
    const time = object(source.timeSignature, "Exercise notation timeSignature", { beats: 4, beatUnit: 4 }); rejectUnknown(time, new Set(["beats", "beatUnit"]), "time-signature");
    const beats = Number(time.beats), beatUnit = Number(time.beatUnit);
    if (!Number.isSafeInteger(beats) || beats < 1 || !Number.isSafeInteger(beatUnit) || beatUnit < 1) throw new ValidationError("Exercise notation requires positive safe time-signature integers.");
    const measuresPerSystem = Number(source.measuresPerSystem ?? 4); if (!Number.isSafeInteger(measuresPerSystem) || measuresPerSystem < 1) throw new ValidationError("measuresPerSystem must be a positive safe integer.");
    const keySignaturePolicy = String(source.keySignaturePolicy ?? "none"); if (!keyPolicies.has(keySignaturePolicy)) throw new ValidationError(`Unsupported key-signature policy: "${keySignaturePolicy}".`);
    if (keySignaturePolicy === "explicit" && source.keySignature === undefined) throw new ValidationError("Explicit key-signature policy requires keySignature.");
    if (keySignaturePolicy !== "explicit" && source.keySignature !== undefined) throw new ValidationError("keySignature is valid only with the explicit policy.");
    const pluginId = optionalId(source.pluginId, "Exercise notation pluginId"), strategyId = optionalId(source.strategyId, "Exercise notation strategyId");
    if (strategyId && !pluginId) throw new ValidationError("Exercise notation strategyId requires pluginId.");
    return Object.freeze({ duration, clef, timeSignature: Object.freeze({ beats, beatUnit }), measuresPerSystem, keySignaturePolicy, keySignature: source.keySignature === undefined ? null : KeySignature.from(source.keySignature), pluginId, strategyId });
}
function renderingOptions(value) {
    const source = object(value, "Rendering options", {}); rejectUnknown(source, renderingKeys, "rendering");
    const format = String(source.format ?? "svg").trim().toLowerCase(); if (!format) throw new ValidationError("Rendering format must be a non-empty string.");
    const pluginId = optionalId(source.pluginId, "Rendering pluginId"), strategyId = optionalId(source.strategyId, "Rendering strategyId");
    if (strategyId && !pluginId) throw new ValidationError("Rendering strategyId requires pluginId.");
    const options = object(source.options, "Renderer-specific options", {}); rejectUnknown(options, rendererOptionKeys, "renderer-specific");
    const normalized = {};
    for (const key of ["width", "height"]) if (options[key] !== undefined) { const number = Number(options[key]); if (!Number.isFinite(number) || number <= 0) throw new ValidationError(`Renderer ${key} must be a positive finite number.`); normalized[key] = number; }
    if (options.title !== undefined) { const title = String(options.title); if (!title.trim()) throw new ValidationError("Renderer title must be a non-empty string."); normalized.title = title; }
    if (options.metadata !== undefined) { object(options.metadata, "Renderer metadata"); try { canonicalSerialize(options.metadata); } catch (cause) { throw new ValidationError(`Renderer metadata is not deterministically serializable: ${cause.message}`, { cause }); } normalized.metadata = options.metadata; }
    return Object.freeze({ format, pluginId, strategyId, options: freezeDeep(cloneDeep(normalized)) });
}

export class ExerciseApplicationRequest {
    constructor(value = {}) {
        if (value instanceof ExerciseApplicationRequest) return value;
        const source = object(value, "Exercise application request"); rejectUnknown(source, requestKeys, "exercise application request");
        if ((source.exercise === undefined) === (source.model === undefined)) throw new ValidationError("Exercise application request requires exactly one of exercise or model.");
        if (source.model !== undefined && !(source.model instanceof ExerciseModel)) throw new ValidationError("Exercise application model must be an immutable ExerciseModel.");
        const exercise = source.exercise === undefined ? null : ExerciseRequest.from(source.exercise);
        const model = source.model ?? null;
        const notation = notationOptions(source.notation), rendering = renderingOptions(source.rendering);
        const sourceId = model?.id ?? exercise.identity;
        const identity = `exercise-presentation-request:${sourceId}:duration:${notation.duration}:clef:${notation.clef}:time:${notation.timeSignature.beats}-${notation.timeSignature.beatUnit}:systems:${notation.measuresPerSystem}:key:${notation.keySignaturePolicy}${notation.keySignature ? `-${notation.keySignature}` : ""}:notation:${notation.pluginId ?? "implicit"}-${notation.strategyId ?? "implicit"}:rendering:${rendering.format}-${rendering.pluginId ?? "implicit"}-${rendering.strategyId ?? "implicit"}:options:${canonicalSerialize(rendering.options)}`;
        Object.defineProperties(this, { exercise: { value: exercise, enumerable: true }, model: { value: model, enumerable: true }, notation: { value: notation, enumerable: true }, rendering: { value: rendering, enumerable: true }, identity: { value: identity, enumerable: true } }); Object.freeze(this);
    }
    static from(value) { return value instanceof ExerciseApplicationRequest ? value : new ExerciseApplicationRequest(value); }
}

export default ExerciseApplicationRequest;
