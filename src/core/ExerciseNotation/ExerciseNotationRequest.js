import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseModel } from "../Exercise/index.js";
import { Clef, Duration, KeySignature } from "../Notation/index.js";

const allowed = new Set(["model", "duration", "clef", "timeSignature", "measuresPerSystem", "keySignaturePolicy", "keySignature", "pluginId", "strategyId"]);
const policies = new Set(["none", "explicit", "exercise-root"]);

export class ExerciseNotationRequest {
    constructor(source = {}) {
        if (source instanceof ExerciseNotationRequest) return source;
        for (const key of Object.keys(source ?? {})) if (!allowed.has(key)) throw new ValidationError(`Unknown exercise notation option: "${key}".`);
        if (!(source.model instanceof ExerciseModel)) throw new ValidationError("Exercise notation requires an ExerciseModel.");
        if (source.duration && !(source.duration instanceof Duration)) {
            const raw = typeof source.duration === "number" ? [source.duration, 1] : [source.duration.numerator, source.duration.denominator];
            if (raw.some(value => !Number.isSafeInteger(Number(value)))) throw new ValidationError("Exercise notation duration values must be safe integers.");
        }
        const duration = Duration.from(source.duration);
        if (!Number.isSafeInteger(duration.numerator) || !Number.isSafeInteger(duration.denominator)) throw new ValidationError("Exercise notation duration values must be safe integers.");
        const clef = Clef.from(source.clef ?? "treble");
        if (!["treble", "bass"].includes(clef.type)) throw new ValidationError("Exercise notation supports treble and bass clefs only.");
        const ts = source.timeSignature ?? { beats: 4, beatUnit: 4 };
        if (!ts || typeof ts !== "object" || Array.isArray(ts) || Object.keys(ts).some(key => !["beats", "beatUnit"].includes(key))) throw new ValidationError("Exercise notation timeSignature accepts beats and beatUnit only.");
        const beats = Number(ts.beats), beatUnit = Number(ts.beatUnit);
        if (!Number.isSafeInteger(beats) || beats < 1 || !Number.isSafeInteger(beatUnit) || beatUnit < 1) throw new ValidationError("Exercise notation requires positive safe time-signature integers.");
        const measuresPerSystem = Number(source.measuresPerSystem ?? 4);
        if (!Number.isSafeInteger(measuresPerSystem) || measuresPerSystem < 1) throw new ValidationError("measuresPerSystem must be a positive safe integer.");
        const keySignaturePolicy = String(source.keySignaturePolicy ?? "none");
        if (!policies.has(keySignaturePolicy)) throw new ValidationError(`Unsupported key-signature policy: "${keySignaturePolicy}".`);
        if (keySignaturePolicy === "explicit" && source.keySignature === undefined) throw new ValidationError("Explicit key-signature policy requires keySignature.");
        if (keySignaturePolicy !== "explicit" && source.keySignature !== undefined) throw new ValidationError("keySignature is valid only with the explicit policy.");
        const keySignature = source.keySignature === undefined ? null : KeySignature.from(source.keySignature);
        if (source.strategyId !== undefined && source.pluginId === undefined) throw new ValidationError("Selecting an exercise notation strategy by id requires pluginId.");
        Object.defineProperties(this, {
            model: { value: source.model, enumerable: true }, duration: { value: duration, enumerable: true }, clef: { value: clef, enumerable: true },
            timeSignature: { value: Object.freeze({ beats, beatUnit }), enumerable: true }, measuresPerSystem: { value: measuresPerSystem, enumerable: true },
            keySignaturePolicy: { value: keySignaturePolicy, enumerable: true }, keySignature: { value: keySignature, enumerable: true },
            pluginId: { value: source.pluginId === undefined ? null : String(source.pluginId), enumerable: true },
            strategyId: { value: source.strategyId === undefined ? null : String(source.strategyId), enumerable: true },
            metadata: { value: freezeDeep(cloneDeep({ exactDurations: true, layoutGeometry: false })), enumerable: true }
        });
        Object.freeze(this);
    }
    static from(value) { return value instanceof ExerciseNotationRequest ? value : new ExerciseNotationRequest(value); }
}
