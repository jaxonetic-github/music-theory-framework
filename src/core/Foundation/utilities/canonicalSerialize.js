function canonicalValue(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new TypeError("Canonical serialization requires finite numbers.");
        return value;
    }
    if (typeof value !== "object") throw new TypeError(`Canonical serialization does not support ${typeof value} values.`);
    if (seen.has(value)) throw new TypeError("Canonical serialization does not support cyclic values.");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new TypeError("Canonical serialization supports plain objects and arrays only.");
    seen.add(value);
    try {
        if (Array.isArray(value)) {
            const keys = Object.keys(value);
            if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) throw new TypeError("Canonical serialization requires dense arrays without extra properties.");
            return value.map(item => canonicalValue(item, seen));
        }
        const ownKeys = Reflect.ownKeys(value);
        if (ownKeys.some(key => typeof key !== "string")) throw new TypeError("Canonical serialization does not support symbol keys.");
        const result = {};
        for (const key of ownKeys.sort()) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Canonical serialization requires enumerable data properties.");
            result[key] = canonicalValue(descriptor.value, seen);
        }
        return result;
    } finally { seen.delete(value); }
}

export function canonicalSerialize(value) { return JSON.stringify(canonicalValue(value, new WeakSet())); }
export default canonicalSerialize;
