import { Identifier, ImmutableValue, Metadata, ValidationError } from "../../Foundation/index.js";

export class TheoryEdge extends ImmutableValue {
    constructor({ id, from, to, type, metadata } = {}) {
        if (id instanceof TheoryEdge) return id;
        const normalizedType = String(type ?? "").trim();
        if (!normalizedType) throw new ValidationError("A theory edge must have a type.");
        const normalizedFrom = Identifier.from(from);
        const normalizedTo = Identifier.from(to);
        super({
            id: Identifier.from(id ?? `${normalizedFrom}:${normalizedType}:${normalizedTo}`),
            from: normalizedFrom,
            to: normalizedTo,
            type: Identifier.from(normalizedType),
            metadata: Metadata.from(metadata)
        });
    }

    static from(value) { return value instanceof TheoryEdge ? value : new TheoryEdge(value); }
    toString() { return String(this.id); }
}

export default TheoryEdge;
