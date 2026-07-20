import { CatalogContract, ValidationError } from "../../Foundation/index.js";
import { defaultProgressions } from "./defaultProgressions.js";
import { ProgressionDefinition } from "./ProgressionDefinition.js";

export class ProgressionCatalog extends CatalogContract {
    #values;
    constructor(values = defaultProgressions) {
        super();
        if (!Array.isArray(values)) throw new ValidationError("ProgressionCatalog requires an ordered array.");
        const entries = values.map(ProgressionDefinition.from);
        if (new Set(entries.map(value => String(value.id))).size !== entries.length) throw new ValidationError("ProgressionCatalog contains duplicate IDs.");
        this.#values = new Map(entries.map(value => [String(value.id), value]));
        Object.freeze(this);
    }
    get(id, options = {}) { const value = this.#values.get(String(id)) ?? null; if (!value && options.required) throw new ValidationError(`Progression "${String(id)}" was not found.`); return value; }
    has(id) { return this.#values.has(String(id)); }
    values() { return Object.freeze([...this.#values.values()]); }
}
