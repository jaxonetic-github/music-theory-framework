import { ValidationError } from "../Foundation/index.js";

export class LayoutProfile {
    constructor({ id, eventGap, measurePadding, clefWidth, keySignatureWidth, barlineWidth, staffHeight, staffSpacing, systemSpacing } = {}) {
        id = String(id ?? "").trim(); if (!id) throw new ValidationError("Layout profile id is required.");
        const values = { eventGap, measurePadding, clefWidth, keySignatureWidth, barlineWidth, staffHeight, staffSpacing, systemSpacing };
        for (const [field, value] of Object.entries(values)) if (!Number.isFinite(value) || value < 0) throw new ValidationError(`Layout profile ${field} must be a non-negative finite number.`);
        Object.defineProperties(this, { id: { value: id, enumerable: true }, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, enumerable: true }])) }); Object.freeze(this);
    }
}

export const layoutProfiles = Object.freeze({
    "screen-compact": new LayoutProfile({ id: "screen-compact", eventGap: 16, measurePadding: 18, clefWidth: 42, keySignatureWidth: 34, barlineWidth: 12, staffHeight: 96, staffSpacing: 38, systemSpacing: 30 }),
    "screen-regular": new LayoutProfile({ id: "screen-regular", eventGap: 24, measurePadding: 24, clefWidth: 48, keySignatureWidth: 40, barlineWidth: 14, staffHeight: 110, staffSpacing: 44, systemSpacing: 42 }),
    "print-worksheet": new LayoutProfile({ id: "print-worksheet", eventGap: 20, measurePadding: 22, clefWidth: 46, keySignatureWidth: 38, barlineWidth: 14, staffHeight: 104, staffSpacing: 42, systemSpacing: 34 })
});

export function resolveLayoutProfile(value = "screen-regular") {
    if (value instanceof LayoutProfile) return value;
    const profile = layoutProfiles[String(value)];
    if (!profile) throw new ValidationError(`Unknown layout profile: "${String(value)}".`);
    return profile;
}
