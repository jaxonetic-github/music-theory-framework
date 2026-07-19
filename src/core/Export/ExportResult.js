import { ImmutableValue, ValidationError } from "../Foundation/index.js";

export class ExportResult extends ImmutableValue {
    constructor({ format, mediaType, extension, content } = {}) {
        const normalizedFormat = String(format ?? "").trim().toLowerCase();
        const normalizedMediaType = String(mediaType ?? "").trim().toLowerCase();
        const normalizedExtension = String(extension ?? "").trim().replace(/^\./, "").toLowerCase();
        if (!normalizedFormat) throw new ValidationError("An export result requires a format.");
        if (!normalizedMediaType || !normalizedMediaType.includes("/")) throw new ValidationError("An export result requires a valid media type.");
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalizedExtension)) throw new ValidationError("An export result requires a valid filename extension.");
        if (typeof content !== "string" || !content.trim()) throw new ValidationError("An export result requires non-empty serialized content.");
        super({ format: normalizedFormat, mediaType: normalizedMediaType, extension: normalizedExtension, content });
    }

    static from(value) { return value instanceof ExportResult ? value : new ExportResult(value); }
}

export default ExportResult;
