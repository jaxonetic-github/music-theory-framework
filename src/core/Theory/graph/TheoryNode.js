import { Identifier, ImmutableValue, Metadata, ValidationError } from "../../Foundation/index.js";

export class TheoryNode extends ImmutableValue {
    constructor({ id, type, value = null, metadata } = {}) {
        if (id instanceof TheoryNode) return id;
        const normalizedType = String(type ?? "").trim();
        if (!normalizedType) throw new ValidationError("A theory node must have a type.");
        super({ id: Identifier.from(id), type: Identifier.from(normalizedType), value, metadata: Metadata.from(metadata) });
    }

    static from(value) { return value instanceof TheoryNode ? value : new TheoryNode(value); }
    toString() { return String(this.id); }
}

export default TheoryNode;
