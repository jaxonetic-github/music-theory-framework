export class RegistrySnapshot {
    constructor({ name, version, records }) {
        this.name = String(name);
        this.version = Number(version);
        this.records = Object.freeze([...records]);
        Object.freeze(this);
    }

    get size() {
        return this.records.length;
    }

    has(id) {
        const key = String(id);
        return this.records.some(record => String(record.id) === key || record.aliases.includes(key));
    }

    get(id) {
        const key = String(id);
        return this.records.find(record => String(record.id) === key || record.aliases.includes(key)) ?? null;
    }

    toJSON() {
        return {
            name: this.name,
            version: this.version,
            records: this.records.map(record => record.toJSON())
        };
    }

    [Symbol.iterator]() {
        return this.records[Symbol.iterator]();
    }
}

export default RegistrySnapshot;
