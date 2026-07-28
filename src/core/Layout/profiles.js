import { ValidationError } from "../Foundation/index.js";

export class LayoutProfile {
    constructor({ id, eventGap, measurePadding, clefWidth, keySignatureWidth, timeSignatureWidth, accidentalWidth, noteheadWidth, stemWidth, flagWidth, restWidth, augmentationDotWidth, barlineWidth, staffHeight, staffLineSpacing, staffSpacing, systemSpacing } = {}) {
        id = String(id ?? "").trim(); if (!id) throw new ValidationError("Layout profile id is required.");
        const values = { eventGap, measurePadding, clefWidth, keySignatureWidth, timeSignatureWidth, accidentalWidth, noteheadWidth, stemWidth, flagWidth, restWidth, augmentationDotWidth, barlineWidth, staffHeight, staffLineSpacing, staffSpacing, systemSpacing };
        for (const [field, value] of Object.entries(values)) if (!Number.isFinite(value) || value < 0) throw new ValidationError(`Layout profile ${field} must be a non-negative finite number.`);
        Object.defineProperties(this, { id: { value: id, enumerable: true }, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, enumerable: true }])) }); Object.freeze(this);
    }
}

export const layoutProfiles = Object.freeze({
    "screen-compact": new LayoutProfile({ id: "screen-compact", eventGap: 17, measurePadding: 14, clefWidth: 42, keySignatureWidth: 85, timeSignatureWidth: 38, accidentalWidth: 18, noteheadWidth: 16, stemWidth: 4, flagWidth: 13, restWidth: 20, augmentationDotWidth: 7, barlineWidth: 4, staffHeight: 116, staffLineSpacing: 12, staffSpacing: 38, systemSpacing: 38 }),
    "screen-regular": new LayoutProfile({ id: "screen-regular", eventGap: 25, measurePadding: 18, clefWidth: 48, keySignatureWidth: 85, timeSignatureWidth: 42, accidentalWidth: 18, noteheadWidth: 18, stemWidth: 4, flagWidth: 14, restWidth: 22, augmentationDotWidth: 7, barlineWidth: 4, staffHeight: 120, staffLineSpacing: 12, staffSpacing: 44, systemSpacing: 48 }),
    "print-worksheet": new LayoutProfile({ id: "print-worksheet", eventGap: 20, measurePadding: 16, clefWidth: 46, keySignatureWidth: 85, timeSignatureWidth: 40, accidentalWidth: 18, noteheadWidth: 17, stemWidth: 4, flagWidth: 13, restWidth: 21, augmentationDotWidth: 7, barlineWidth: 4, staffHeight: 118, staffLineSpacing: 12, staffSpacing: 42, systemSpacing: 44 })
});

export function resolveLayoutProfile(value = "screen-regular") {
    if (value instanceof LayoutProfile) return value;
    const profile = layoutProfiles[String(value)];
    if (!profile) throw new ValidationError(`Unknown layout profile: "${String(value)}".`);
    return profile;
}
