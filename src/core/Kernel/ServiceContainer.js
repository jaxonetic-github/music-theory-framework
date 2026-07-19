import { ValidationError } from "../Foundation/index.js";

export class ServiceContainer {
    #entries = new Map();
    #resolving = [];

    register(id, value, options = {}) {
        const key = String(id);
        if (this.#entries.has(key) && !options.replace) throw new ValidationError(`Service "${key}" is already registered.`);
        this.#entries.set(key, { provider: value, factory: false, singleton: true, resolved: true, value });
        return value;
    }

    factory(id, provider, options = {}) {
        if (typeof provider !== "function") throw new ValidationError("A service factory must be a function.");
        const key = String(id);
        if (this.#entries.has(key) && !options.replace) throw new ValidationError(`Service "${key}" is already registered.`);
        this.#entries.set(key, { provider, factory: true, singleton: options.singleton !== false, resolved: false, value: undefined });
        return provider;
    }

    has(id) { return this.#entries.has(String(id)); }

    resolve(id, options = {}) {
        const key = String(id);
        const entry = this.#entries.get(key);
        if (!entry) {
            if (options.optional) return options.defaultValue ?? null;
            throw new ValidationError(`Service "${key}" is not registered.`);
        }
        if (!entry.factory) return entry.value;
        if (entry.singleton && entry.resolved) return entry.value;
        if (this.#resolving.includes(key)) {
            throw new ValidationError(`Circular service dependency: ${[...this.#resolving, key].join(" -> ")}.`);
        }
        this.#resolving.push(key);
        try {
            const value = entry.provider(this);
            if (entry.singleton) { entry.value = value; entry.resolved = true; }
            return value;
        } finally {
            this.#resolving.pop();
        }
    }

    unregister(id) { return this.#entries.delete(String(id)); }
    clear() { const count = this.#entries.size; this.#entries.clear(); return count; }
}

export default ServiceContainer;
