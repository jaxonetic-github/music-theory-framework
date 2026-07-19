import { ValidationError } from "../Foundation/index.js";

export class CommandBus {
    #handlers = new Map();

    register(type, handler, options = {}) {
        if (typeof handler !== "function") throw new ValidationError("Command handlers must be functions.");
        const key = String(type);
        if (this.#handlers.has(key) && !options.replace) {
            throw new ValidationError(`A handler is already registered for command "${key}".`);
        }
        this.#handlers.set(key, handler);
        return () => this.#handlers.get(key) === handler && this.#handlers.delete(key);
    }

    has(type) { return this.#handlers.has(String(type)); }

    async execute(type, payload, context = {}) {
        const key = String(type);
        const handler = this.#handlers.get(key);
        if (!handler) throw new ValidationError(`No handler is registered for command "${key}".`);
        return handler(payload, Object.freeze({ ...context, type: key }));
    }

    unregister(type) { return this.#handlers.delete(String(type)); }
    clear() { const count = this.#handlers.size; this.#handlers.clear(); return count; }
}

export default CommandBus;
