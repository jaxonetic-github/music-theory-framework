function escapeXml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function stableValue(value) {
    if (value && typeof value.toJSON === "function") return stableValue(value.toJSON());
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
    }
    return value;
}

export function xmlText(value) { return escapeXml(value); }
export function xmlAttribute(value) { return escapeXml(value); }
export function metadataText(value) { return JSON.stringify(stableValue(value)); }
