import { ValidationError } from "../Foundation/index.js";

export const engravingMetricDefaults = Object.freeze({
    timeSignatureWidth: 42,
    accidentalWidth: 18,
    noteheadWidth: 18,
    stemWidth: 4,
    flagWidth: 14,
    restWidth: 22,
    augmentationDotWidth: 7,
    staffLineSpacing: 12
});

export class LayoutProfile {
    constructor(input = {}) {
        const {
            id, eventGap, measurePadding, clefWidth, keySignatureWidth,
            timeSignatureWidth = engravingMetricDefaults.timeSignatureWidth,
            accidentalWidth = engravingMetricDefaults.accidentalWidth,
            noteheadWidth = engravingMetricDefaults.noteheadWidth,
            stemWidth = engravingMetricDefaults.stemWidth,
            flagWidth = engravingMetricDefaults.flagWidth,
            restWidth = engravingMetricDefaults.restWidth,
            augmentationDotWidth = engravingMetricDefaults.augmentationDotWidth,
            barlineWidth, staffHeight,
            staffLineSpacing = engravingMetricDefaults.staffLineSpacing,
            staffSpacing, systemSpacing
        } = input;
        const normalizedId = String(id ?? "").trim(); if (!normalizedId) throw new ValidationError("Layout profile id is required.");
        const legacyValues = { eventGap, measurePadding, clefWidth, keySignatureWidth, barlineWidth, staffHeight, staffSpacing, systemSpacing };
        for (const [field, value] of Object.entries(legacyValues)) if (!Number.isFinite(value) || value < 0) throw new ValidationError(`Layout profile ${field} must be a non-negative finite number.`);
        const engravingValues = { timeSignatureWidth, accidentalWidth, noteheadWidth, stemWidth, flagWidth, restWidth, augmentationDotWidth, staffLineSpacing };
        for (const [field, value] of Object.entries(engravingValues)) if (!Number.isFinite(value) || value <= 0) throw new ValidationError(`Layout profile ${field} must be a positive finite number.`);
        const values = { eventGap, measurePadding, clefWidth, keySignatureWidth, ...engravingValues, barlineWidth, staffHeight, staffSpacing, systemSpacing };
        Object.defineProperties(this, { id: { value: normalizedId, enumerable: true }, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, enumerable: true }])) }); Object.freeze(this);
    }
}

export const layoutProfiles = Object.freeze({
    "screen-compact": new LayoutProfile({ id: "screen-compact", eventGap: 17, measurePadding: 14, clefWidth: 42, keySignatureWidth: 85, timeSignatureWidth: 38, noteheadWidth: 16, flagWidth: 13, restWidth: 20, barlineWidth: 4, staffHeight: 116, staffSpacing: 38, systemSpacing: 38 }),
    "screen-regular": new LayoutProfile({ id: "screen-regular", eventGap: 25, measurePadding: 18, clefWidth: 48, keySignatureWidth: 85, barlineWidth: 4, staffHeight: 120, staffSpacing: 44, systemSpacing: 48 }),
    "print-worksheet": new LayoutProfile({ id: "print-worksheet", eventGap: 20, measurePadding: 16, clefWidth: 46, keySignatureWidth: 85, timeSignatureWidth: 40, noteheadWidth: 17, flagWidth: 13, restWidth: 21, barlineWidth: 4, staffHeight: 118, staffSpacing: 42, systemSpacing: 44 })
});

export function resolveLayoutProfile(value = "screen-regular") {
    if (value instanceof LayoutProfile) return value;
    const profile = layoutProfiles[String(value)];
    if (!profile) throw new ValidationError(`Unknown layout profile: "${String(value)}".`);
    return profile;
}
