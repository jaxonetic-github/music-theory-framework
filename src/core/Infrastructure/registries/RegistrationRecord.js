import { Identifier, Metadata } from "../../Foundation/index.js";

export class RegistrationRecord {
    constructor({ id, descriptor, value = descriptor, aliases = [], metadata = {}, sequence = 0 }) {
        this.id = Identifier.from(id);
        this.descriptor = descriptor;
        this.value = value;
        this.aliases = Object.freeze([...new Set(aliases.map(alias => String(Identifier.from(alias))))]);
        this.metadata = Metadata.from(metadata);
        this.sequence = sequence;
        Object.freeze(this);
    }

    toObject() {
        return {
            id: String(this.id),
            descriptorType: this.descriptor?.descriptorType ?? null,
            aliases: [...this.aliases],
            sequence: this.sequence,
            metadata: this.metadata.toJSON()
        };
    }

    toJSON() {
        return this.toObject();
    }
}

export default RegistrationRecord;
