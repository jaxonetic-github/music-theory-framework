import { CatalogContract, ValidationError } from "../../Foundation/index.js";

export class PatternCatalog extends CatalogContract {
    #patterns = new Map();
    #PatternType;

    constructor(PatternType, patterns = []) {
        super();
        this.#PatternType = PatternType;
        for (const pattern of patterns) this.add(pattern);
        Object.seal(this);
    }

    get size() { return this.#patterns.size; }

    add(pattern, options = {}) {
        const normalized = this.#PatternType.from(pattern);
        const key = String(normalized.id);
        if (this.#patterns.has(key) && !options.replace) throw new ValidationError(`Pattern "${key}" is already in the catalog.`);
        this.#patterns.set(key, normalized);
        return normalized;
    }

    get(id, options = {}) {
        const pattern = this.#patterns.get(String(id)) ?? null;
        if (!pattern && options.required) throw new ValidationError(`Pattern "${String(id)}" was not found.`);
        return pattern;
    }

    has(id) { return this.#patterns.has(String(id)); }
    values() { return Object.freeze([...this.#patterns.values()]); }
    ids() { return Object.freeze([...this.#patterns.keys()]); }
    [Symbol.iterator]() { return this.values()[Symbol.iterator](); }
}

export default PatternCatalog;
