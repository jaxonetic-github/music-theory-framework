import { ImmutableValue, ValidationError } from "../Foundation/index.js";

const requestKeys = new Set(["type", "root", "pattern", "quality", "generationOptions", "notationOptions", "rendering", "export"]);
const stageKeys = new Set(["format", "pluginId", "strategyId", "options"]);

function rejectUnknown(source, allowed, label) {
    const unknown = Object.keys(source).filter(key => !allowed.has(key));
    if (unknown.length) throw new ValidationError(`Unknown ${label} field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
}

function options(value, label) {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new ValidationError(`${label} must be an object.`);
    }
    return value;
}

function nonEmpty(value, label) {
    const normalized = String(value ?? "").trim();
    if (!normalized) throw new ValidationError(`${label} must be a non-empty string.`);
    return normalized;
}

function optionalId(value, label) {
    return value === undefined ? null : nonEmpty(value, label);
}

function stageRequest(value, label) {
    if (value === undefined) return null;
    const source = options(value, `${label} request`);
    rejectUnknown(source, stageKeys, `${label} request`);
    const pluginId = optionalId(source.pluginId, `${label} pluginId`);
    const strategyId = optionalId(source.strategyId, `${label} strategyId`);
    if (strategyId && !pluginId) throw new ValidationError(`${label} strategyId requires a pluginId.`);
    return Object.freeze({
        format: nonEmpty(source.format, `${label} format`).toLowerCase(),
        pluginId,
        strategyId,
        options: options(source.options, `${label} options`)
    });
}

export class ApplicationRequest extends ImmutableValue {
    constructor(value = {}) {
        if (value instanceof ApplicationRequest) return value;
        const source = options(value, "Application request");
        rejectUnknown(source, requestKeys, "application request");
        const type = String(source.type ?? "").trim().toLowerCase();
        if (!new Set(["scale", "chord"]).has(type)) {
            throw new ValidationError('Application request type must be "scale" or "chord".');
        }
        const root = nonEmpty(source.root, "Application request root");
        if (type === "scale" && source.quality !== undefined) {
            throw new ValidationError("Scale requests use pattern, not quality.");
        }
        if (type === "chord" && source.pattern !== undefined) {
            throw new ValidationError("Chord requests use quality, not pattern.");
        }
        const pattern = type === "scale" ? nonEmpty(source.pattern, "Scale pattern") : null;
        const quality = type === "chord" ? nonEmpty(source.quality, "Chord quality") : null;
        super({
            type,
            root,
            pattern,
            quality,
            generationOptions: options(source.generationOptions, "Generation options"),
            notationOptions: options(source.notationOptions, "Notation options"),
            rendering: stageRequest(source.rendering, "Rendering"),
            export: stageRequest(source.export, "Export")
        });
    }

    static from(value) { return value instanceof ApplicationRequest ? value : new ApplicationRequest(value); }
    get selection() { return this.type === "scale" ? this.pattern : this.quality; }
}

export default ApplicationRequest;
