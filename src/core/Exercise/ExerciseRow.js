import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { PitchClass } from "../Theory/index.js";
import { ExerciseDirection } from "./ExerciseDirection.js";
import { ExerciseStep } from "./ExerciseStep.js";
import { ExerciseType } from "./ExerciseType.js";

export class ExerciseRow {
    constructor({ id, title, subtitle = null, root, pattern = null, quality = null, direction, octaves, startingOctave, type, steps = [], metadata = {} } = {}) {
        const normalizedId = String(id ?? "").trim();
        const normalizedTitle = String(title ?? "").trim();
        if (!normalizedId || !normalizedTitle) throw new ValidationError("Exercise rows require id and title.");
        if (![1, 2].includes(Number(octaves))) throw new ValidationError("Exercise row octaves must be 1 or 2.");
        if (!Number.isInteger(Number(startingOctave)) || Number(startingOctave) < -1 || Number(startingOctave) > 9) {
            throw new ValidationError("Exercise row startingOctave must be an integer from -1 through 9.");
        }
        if (!Array.isArray(steps) || steps.length === 0 || steps.some(step => !(step instanceof ExerciseStep))) throw new ValidationError("Exercise rows require ExerciseStep values.");
        const ids = new Set();
        steps.forEach((step, index) => {
            if (step.sequence !== index + 1) throw new ValidationError("Exercise row step sequences must be contiguous and ordered.");
            if (ids.has(step.id)) throw new ValidationError(`Duplicate exercise step id: "${step.id}".`);
            ids.add(step.id);
        });
        Object.defineProperties(this, {
            id: { value: normalizedId, enumerable: true }, title: { value: normalizedTitle, enumerable: true },
            subtitle: { value: subtitle === null ? null : String(subtitle), enumerable: true }, root: { value: PitchClass.from(root), enumerable: true },
            pattern: { value: pattern === null ? null : String(pattern), enumerable: true }, quality: { value: quality === null ? null : String(quality), enumerable: true },
            direction: { value: ExerciseDirection.from(direction), enumerable: true }, octaves: { value: Number(octaves), enumerable: true },
            startingOctave: { value: Number(startingOctave), enumerable: true }, type: { value: ExerciseType.from(type), enumerable: true },
            steps: { value: Object.freeze([...steps]), enumerable: true }, metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true },
            writtenPitches: { value: Object.freeze(steps.flatMap(step => step.writtenPitches)), enumerable: true }
        });
        Object.freeze(this);
    }
}

export default ExerciseRow;
