import { cloneDeep, freezeDeep, Identifier, ImmutableValue, ValidationError } from "../../Foundation/index.js";

export class ProgressionDefinition extends ImmutableValue {
    constructor({ id, name, mode, events } = {}) {
        if (id instanceof ProgressionDefinition) return id;
        const normalizedMode = String(mode ?? "").trim().toLowerCase();
        if (!["major", "minor"].includes(normalizedMode)) throw new ValidationError("A progression mode must be major or minor.");
        if (!Array.isArray(events) || events.length === 0) throw new ValidationError("A progression requires ordered harmonic events.");
        const progressionId = Identifier.from(id);
        const normalized = events.map((event, index) => {
            const degree = Number(event?.degree), quality = String(event?.quality ?? "").trim(), romanNumeral = String(event?.romanNumeral ?? "").trim();
            if (!Number.isSafeInteger(degree) || degree < 1 || degree > 7 || !quality || !romanNumeral) throw new ValidationError("Invalid progression harmonic event.");
            return freezeDeep(cloneDeep({ id: `${progressionId}:event:${index + 1}`, position: index + 1, degree, quality, romanNumeral, function: String(event.function ?? romanNumeral) }));
        });
        super({ id: progressionId, name: String(name ?? id), mode: normalizedMode, events: Object.freeze(normalized) });
    }
    static from(value) { return value instanceof ProgressionDefinition ? value : new ProgressionDefinition(value); }
    toString() { return String(this.id); }
}
