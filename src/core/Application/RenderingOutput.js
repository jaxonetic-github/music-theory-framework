import { ImmutableValue, ValidationError } from "../Foundation/index.js";

export class RenderingOutput extends ImmutableValue {
    constructor({ format, content } = {}) {
        const normalizedFormat = String(format ?? "").trim().toLowerCase();
        if (!normalizedFormat) throw new ValidationError("A rendering output requires a format.");
        if (typeof content !== "string" || !content.trim()) throw new ValidationError("A rendering output requires non-empty content.");
        super({ format: normalizedFormat, content });
    }
}

export default RenderingOutput;
