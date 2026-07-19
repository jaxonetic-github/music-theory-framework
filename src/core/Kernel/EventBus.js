import { ValidationError } from "../Foundation/index.js";

export class EventBus {
    #listeners = new Map();
    #sequence = 0;

    subscribe(type, listener, options = {}) {
        if (typeof listener !== "function") throw new ValidationError("Event listeners must be functions.");
        const key = String(type);
        const entry = { listener, once: Boolean(options.once), priority: Number(options.priority ?? 0), sequence: ++this.#sequence };
        const entries = this.#listeners.get(key) ?? [];
        entries.push(entry);
        entries.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
        this.#listeners.set(key, entries);
        return () => this.#remove(key, entry);
    }

    once(type, listener, options = {}) {
        return this.subscribe(type, listener, { ...options, once: true });
    }

    listenerCount(type) {
        return (this.#listeners.get(String(type)) ?? []).length;
    }

    async publish(type, payload, options = {}) {
        const event = Object.freeze({
            type: String(type),
            payload,
            source: options.source ?? null,
            timestamp: options.timestamp ?? Date.now(),
            metadata: Object.freeze({ ...(options.metadata ?? {}) })
        });
        const entries = [...(this.#listeners.get(event.type) ?? []), ...(this.#listeners.get("*") ?? [])];
        entries.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
        const results = [];
        for (const entry of entries) {
            if (entry.once) {
                this.#remove(event.type, entry);
                this.#remove("*", entry);
            }
            results.push(await entry.listener(event));
        }
        return Object.freeze(results);
    }

    clear(type) {
        if (type === undefined) {
            const count = [...this.#listeners.values()].reduce((total, entries) => total + entries.length, 0);
            this.#listeners.clear();
            return count;
        }
        const key = String(type);
        const count = this.listenerCount(key);
        this.#listeners.delete(key);
        return count;
    }

    #remove(type, entry) {
        const entries = this.#listeners.get(type);
        if (!entries) return false;
        const index = entries.indexOf(entry);
        if (index < 0) return false;
        entries.splice(index, 1);
        if (entries.length === 0) this.#listeners.delete(type);
        return true;
    }
}

export default EventBus;
