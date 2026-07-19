import {
    Identifier,
    RegistryContract,
    ValidationError
} from "../../Foundation/index.js";
import { RegistrationRecord } from "./RegistrationRecord.js";
import { RegistrySnapshot } from "./RegistrySnapshot.js";

function descriptorId(descriptor) {
    if (!descriptor || typeof descriptor !== "object") {
        throw new ValidationError("A registry descriptor must be an object.");
    }
    if (descriptor.id === undefined || descriptor.id === null) {
        throw new ValidationError("A registry descriptor must expose an id.");
    }
    return Identifier.from(descriptor.id);
}

function dependencyEntries(descriptor) {
    const source = descriptor?.dependencies;
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (Array.isArray(source.values)) return source.values;
    if (typeof source[Symbol.iterator] === "function") return [...source];
    return [];
}

export class Registry extends RegistryContract {
    #records = new Map();
    #aliases = new Map();
    #version = 0;
    #sequence = 0;
    #listeners = new Set();

    constructor({
        name = "registry",
        acceptedDescriptorTypes = [],
        strictDependencies = false,
        allowReplacement = false
    } = {}) {
        super();
        this.name = String(name);
        this.acceptedDescriptorTypes = Object.freeze([...new Set(acceptedDescriptorTypes.map(String))]);
        this.strictDependencies = Boolean(strictDependencies);
        this.allowReplacement = Boolean(allowReplacement);
        Object.seal(this);
    }

    get size() { return this.#records.size; }
    get version() { return this.#version; }

    validate(descriptor) {
        descriptorId(descriptor);
        const type = descriptor.descriptorType;
        if (this.acceptedDescriptorTypes.length > 0 && !this.acceptedDescriptorTypes.includes(type)) {
            throw new ValidationError(
                `${this.name} accepts descriptor types [${this.acceptedDescriptorTypes.join(", ")}], received "${type ?? "unknown"}".`
            );
        }
        return true;
    }

    register(descriptor, options = {}) {
        this.validate(descriptor);
        const id = descriptorId(descriptor);
        const key = String(id);
        const replace = options.replace ?? this.allowReplacement;

        if (this.#records.has(key) && !replace) {
            throw new ValidationError(`Duplicate registration: "${key}" already exists in ${this.name}.`);
        }

        const aliases = [...new Set((options.aliases ?? []).map(alias => String(Identifier.from(alias))))];
        for (const alias of aliases) {
            const owner = this.#aliases.get(alias);
            if (owner && owner !== key) {
                throw new ValidationError(`Alias "${alias}" is already assigned to "${owner}".`);
            }
            if (this.#records.has(alias) && alias !== key) {
                throw new ValidationError(`Alias "${alias}" conflicts with a registered identifier.`);
            }
        }

        if (this.strictDependencies || options.validateDependencies) {
            const missing = dependencyEntries(descriptor)
                .filter(dependency => !dependency.optional)
                .map(dependency => String(dependency.target ?? dependency.id ?? dependency))
                .filter(target => !this.has(target));
            if (missing.length > 0) {
                throw new ValidationError(`Unresolved dependencies for "${key}": ${missing.join(", ")}.`);
            }
        }

        const previous = this.#records.get(key) ?? null;
        if (previous) {
            for (const alias of previous.aliases) this.#aliases.delete(alias);
        }

        const record = new RegistrationRecord({
            id,
            descriptor,
            value: options.value ?? descriptor,
            aliases,
            metadata: options.metadata,
            sequence: ++this.#sequence
        });
        this.#records.set(key, record);
        for (const alias of aliases) this.#aliases.set(alias, key);
        this.#version += 1;
        this.#emit(previous ? "replaced" : "registered", record, previous);
        return record;
    }

    registerMany(descriptors, options = {}) {
        if (!descriptors || typeof descriptors[Symbol.iterator] !== "function") {
            throw new ValidationError("registerMany() requires an iterable.");
        }
        const registered = [];
        for (const descriptor of descriptors) registered.push(this.register(descriptor, options));
        return Object.freeze(registered);
    }

    has(id) {
        const key = String(id);
        return this.#records.has(key) || this.#aliases.has(key);
    }

    getRecord(id) {
        const key = String(id);
        const canonical = this.#aliases.get(key) ?? key;
        return this.#records.get(canonical) ?? null;
    }

    resolve(id, options = {}) {
        const record = this.getRecord(id);
        if (!record && options.required) {
            throw new ValidationError(`Registration "${String(id)}" was not found in ${this.name}.`);
        }
        return record?.value ?? options.defaultValue ?? null;
    }

    descriptor(id, options = {}) {
        const record = this.getRecord(id);
        if (!record && options.required) {
            throw new ValidationError(`Descriptor "${String(id)}" was not found in ${this.name}.`);
        }
        return record?.descriptor ?? options.defaultValue ?? null;
    }

    unregister(id, options = {}) {
        const record = this.getRecord(id);
        if (!record) {
            if (options.required) throw new ValidationError(`Cannot unregister missing id "${String(id)}".`);
            return null;
        }
        const key = String(record.id);
        this.#records.delete(key);
        for (const alias of record.aliases) this.#aliases.delete(alias);
        this.#version += 1;
        this.#emit("unregistered", record, null);
        return record;
    }

    clear() {
        if (this.#records.size === 0) return 0;
        const count = this.#records.size;
        this.#records.clear();
        this.#aliases.clear();
        this.#version += 1;
        this.#emit("cleared", null, null);
        return count;
    }

    records() {
        return Object.freeze([...this.#records.values()].sort((a, b) => a.sequence - b.sequence));
    }

    descriptors() {
        return Object.freeze(this.records().map(record => record.descriptor));
    }

    values() {
        return Object.freeze(this.records().map(record => record.value));
    }

    ids() {
        return Object.freeze(this.records().map(record => String(record.id)));
    }

    find(predicate) {
        if (typeof predicate !== "function") throw new ValidationError("find() requires a predicate function.");
        return this.records().find((record, index) => predicate(record.value, record, index))?.value ?? null;
    }

    filter(predicate) {
        if (typeof predicate !== "function") throw new ValidationError("filter() requires a predicate function.");
        return Object.freeze(this.records()
            .filter((record, index) => predicate(record.value, record, index))
            .map(record => record.value));
    }

    snapshot() {
        return new RegistrySnapshot({ name: this.name, version: this.version, records: this.records() });
    }

    subscribe(listener) {
        if (typeof listener !== "function") throw new ValidationError("subscribe() requires a listener function.");
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #emit(type, record, previous) {
        const event = Object.freeze({
            type,
            registry: this.name,
            version: this.version,
            record,
            previous
        });
        for (const listener of this.#listeners) listener(event);
    }

    toJSON() {
        return this.snapshot().toJSON();
    }

    [Symbol.iterator]() {
        return this.values()[Symbol.iterator]();
    }
}

export default Registry;
