import { PitchClass } from "../Theory/index.js";
import { ValidationError } from "../Foundation/index.js";
import { ExerciseDirection } from "./ExerciseDirection.js";
import { ExerciseType } from "./ExerciseType.js";
import { requestIdentity } from "./identity.js";
import { ApproachPattern, ChordTarget, EnclosurePattern } from "./advanced/index.js";

export const CANONICAL_EXERCISE_ROOTS = Object.freeze(["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]);
const keys = new Set(["type", "root", "roots", "allKeys", "pattern", "quality", "direction", "octaves", "startingOctave", "pluginId", "strategyId", "approachPattern", "enclosurePattern", "target", "progression"]);

function optionalId(value, label) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) throw new ValidationError(`${label} must be a non-empty string.`);
    return normalized;
}

function normalizeRoots(value) {
    const roots = Object.freeze(value.map(root => PitchClass.from(root)));
    if (roots.length === 0) throw new ValidationError("Exercise roots must not be empty.");
    const seen = new Set();
    for (const root of roots) {
        if (seen.has(root.semitones)) throw new ValidationError(`Exercise roots contain an enharmonic duplicate: "${root}".`);
        seen.add(root.semitones);
    }
    return roots;
}

export class ExerciseRequest {
    constructor(value = {}) {
        if (value instanceof ExerciseRequest) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Exercise request must be an object.");
        const unknown = Object.keys(value).filter(key => !keys.has(key));
        if (unknown.length) throw new ValidationError(`Unknown exercise option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
        const type = ExerciseType.from(value.type ?? "scale");
        const allKeys = value.allKeys ?? false;
        if (typeof allKeys !== "boolean") throw new ValidationError("Exercise allKeys must be a boolean.");
        if (allKeys && (value.root !== undefined || value.roots !== undefined)) throw new ValidationError("Exercise allKeys cannot be combined with root or roots.");
        if (value.root !== undefined && value.roots !== undefined) throw new ValidationError("Provide either exercise root or roots, not both.");
        if (value.roots !== undefined && (!Array.isArray(value.roots))) throw new ValidationError("Exercise roots must be an ordered array.");
        const roots = normalizeRoots(allKeys ? CANONICAL_EXERCISE_ROOTS : value.roots ?? [value.root ?? "C"]);
        const family = String(type);
        const scaleFamily = ["scale", "scale-thirds"].includes(family);
        const chordFamily = ["arpeggio-triad", "arpeggio-seventh", "chord-blocked", "chord-broken"].includes(family);
        const targetFamily = ["approach-note", "enclosure"].includes(family);
        const progressionFamily = family === "chord-progression";
        if (!scaleFamily && value.pattern !== undefined) throw new ValidationError("Only scale exercises accept a scale pattern.");
        if ((scaleFamily || progressionFamily) && value.quality !== undefined) throw new ValidationError(`${family} exercises do not accept a chord quality.`);
        if (!targetFamily && (value.approachPattern !== undefined || value.enclosurePattern !== undefined || value.target !== undefined)) throw new ValidationError("Approach and enclosure options are valid only for their advanced target families.");
        if (family !== "approach-note" && value.approachPattern !== undefined) throw new ValidationError("approachPattern is valid only for approach-note exercises.");
        if (family !== "enclosure" && value.enclosurePattern !== undefined) throw new ValidationError("enclosurePattern is valid only for enclosure exercises.");
        if (!progressionFamily && value.progression !== undefined) throw new ValidationError("progression is valid only for chord-progression exercises.");
        const pattern = scaleFamily ? String(value.pattern ?? "major").trim() : null;
        const quality = (chordFamily || targetFamily) ? String(value.quality ?? "major").trim() : null;
        if (scaleFamily && !pattern) throw new ValidationError("Exercise scale pattern must be non-empty.");
        if ((chordFamily || targetFamily) && !quality) throw new ValidationError("Exercise chord quality must be non-empty.");
        const approachPattern = family === "approach-note" ? ApproachPattern.from(value.approachPattern) : null;
        const enclosurePattern = family === "enclosure" ? EnclosurePattern.from(value.enclosurePattern) : null;
        const target = targetFamily ? ChordTarget.from(value.target) : null;
        const progression = progressionFamily ? String(value.progression ?? "ii-v-i-major").trim() : null;
        if (progressionFamily && !progression) throw new ValidationError("Exercise progression must be non-empty.");
        if (["approach-note", "enclosure", "chord-progression"].includes(family) && value.direction !== undefined && String(value.direction) !== "ascending") throw new ValidationError(`${family} exercises support ascending semantic order only.`);
        if (["approach-note", "enclosure", "chord-progression"].includes(family) && value.octaves !== undefined && Number(value.octaves) !== 1) throw new ValidationError(`${family} exercises support one semantic octave only.`);
        const direction = ExerciseDirection.from(value.direction ?? "ascending");
        const octaves = Number(value.octaves ?? 1);
        if (![1, 2].includes(octaves)) throw new ValidationError("Exercise octaves must be 1 or 2.");
        const startingOctave = Number(value.startingOctave ?? 4);
        if (!Number.isInteger(startingOctave) || startingOctave < -1 || startingOctave > 9) {
            throw new ValidationError("Exercise startingOctave must be an integer from -1 through 9.");
        }
        const pluginId = optionalId(value.pluginId, "Exercise pluginId");
        const strategyId = optionalId(value.strategyId, "Exercise strategyId");
        if (strategyId && !pluginId) throw new ValidationError("Exercise strategyId requires a pluginId.");
        Object.defineProperties(this, {
            type: { value: type, enumerable: true }, roots: { value: roots, enumerable: true }, allKeys: { value: allKeys, enumerable: true },
            pattern: { value: pattern, enumerable: true }, quality: { value: quality, enumerable: true },
            approachPattern: { value: approachPattern, enumerable: true }, enclosurePattern: { value: enclosurePattern, enumerable: true },
            target: { value: target, enumerable: true }, progression: { value: progression, enumerable: true },
            direction: { value: direction, enumerable: true }, octaves: { value: octaves, enumerable: true },
            startingOctave: { value: startingOctave, enumerable: true }, pluginId: { value: pluginId, enumerable: true },
            strategyId: { value: strategyId, enumerable: true }
        });
        Object.defineProperty(this, "identity", { value: requestIdentity(this), enumerable: true });
        Object.freeze(this);
    }
    static from(value) { return value instanceof ExerciseRequest ? value : new ExerciseRequest(value); }
}

export default ExerciseRequest;
