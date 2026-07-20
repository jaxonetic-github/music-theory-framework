import {
    EXERCISE_DIRECTIONS,
    EXERCISE_TYPES,
    ExerciseApplicationRequest
} from "../../core/index.js";

export const exerciseFamilyOptions = Object.freeze([
    ["scale", "Scale"], ["scale-thirds", "Scale in thirds"],
    ["arpeggio-triad", "Triad arpeggio"], ["arpeggio-seventh", "Seventh arpeggio"],
    ["chord-blocked", "Blocked chord"], ["chord-broken", "Broken chord"]
].map(([id, label]) => Object.freeze({ id, label })));
export const exerciseDirectionOptions = Object.freeze(EXERCISE_DIRECTIONS.map(id => Object.freeze({ id, label: id.replaceAll("-", " ") })));
export const exerciseDurationOptions = Object.freeze([
    { id: "1/2", label: "Half note" }, { id: "1/4", label: "Quarter note" },
    { id: "1/8", label: "Eighth note" }, { id: "1/16", label: "Sixteenth note" }
].map(Object.freeze));

const scaleFamily = type => type === "scale" || type === "scale-thirds";
const chordCount = type => type === "arpeggio-triad" ? 3 : type === "arpeggio-seventh" ? 4 : null;
const first = (values, label) => {
    const value = values?.[0]?.id;
    if (!value) throw new Error(`The ${label} catalog has no compatible choices.`);
    return String(value);
};
export function exerciseChoicesForFamily(catalogs, type) {
    if (scaleFamily(type)) return catalogs.scales;
    const count = chordCount(type);
    return count ? catalogs.chords.filter(value => value.memberCount === count) : catalogs.chords;
}

export function createInitialExercisePracticeState(catalogs) {
    return Object.freeze({
        type: "scale", root: "C", allKeys: false, pattern: first(catalogs.scales, "scale"),
        direction: "ascending", octaves: 1, startingOctave: 4, duration: "1/4", clef: "treble",
        beats: 4, beatUnit: 4, measuresPerSystem: 4, keySignaturePolicy: "none"
    });
}

export function transitionExercisePracticeState(state, change, catalogs) {
    if (!change || typeof change !== "object" || Array.isArray(change)) throw new TypeError("An exercise state change must be an object.");
    const next = { ...state, ...change };
    if (change.type !== undefined) {
        const type = String(change.type);
        if (!EXERCISE_TYPES.includes(type)) throw new TypeError(`Unsupported exercise family: ${type}.`);
        next.type = type;
        if (scaleFamily(type)) {
            delete next.quality;
            if (!catalogs.scales.some(value => value.id === next.pattern)) next.pattern = first(catalogs.scales, "scale");
        } else {
            delete next.pattern;
            const choices = exerciseChoicesForFamily(catalogs, type);
            if (!choices.some(value => value.id === next.quality)) next.quality = first(choices, "chord");
        }
        if (!EXERCISE_DIRECTIONS.includes(next.direction)) next.direction = "ascending";
    }
    if (next.allKeys) delete next.root;
    else if (state.allKeys && change.allKeys === false && !String(next.root ?? "").trim()) next.root = "C";
    if (next.keySignaturePolicy !== "explicit") {
        delete next.keySignatureTonic;
        delete next.keySignatureMode;
    } else {
        next.keySignatureTonic ??= "C";
        next.keySignatureMode ??= "major";
    }
    return Object.freeze(next);
}

function duration(value) {
    const match = /^(\d+)\/(\d+)$/.exec(String(value));
    if (!match) throw new TypeError("Notation duration must use numerator/denominator form.");
    return Object.freeze({ numerator: Number(match[1]), denominator: Number(match[2]) });
}

export function buildExerciseApplicationRequest(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("Exercise practice state must be an object.");
    const type = String(state.type ?? "");
    if (!EXERCISE_TYPES.includes(type)) throw new TypeError("Select a supported exercise family.");
    const isScale = scaleFamily(type);
    const allKeys = Boolean(state.allKeys);
    const exercise = {
        type, allKeys, ...(!allKeys ? { root: String(state.root ?? "").trim() } : {}),
        ...(isScale ? { pattern: String(state.pattern ?? "").trim() } : { quality: String(state.quality ?? "").trim() }),
        direction: String(state.direction ?? "ascending"), octaves: Number(state.octaves),
        startingOctave: Number(state.startingOctave)
    };
    const policy = String(state.keySignaturePolicy ?? "none");
    const notation = {
        duration: duration(state.duration), clef: String(state.clef ?? "treble"),
        timeSignature: { beats: Number(state.beats), beatUnit: Number(state.beatUnit) },
        measuresPerSystem: Number(state.measuresPerSystem), keySignaturePolicy: policy,
        ...(policy === "explicit" ? { keySignature: { tonic: String(state.keySignatureTonic ?? "").trim(), mode: String(state.keySignatureMode ?? "major") } } : {})
    };
    return new ExerciseApplicationRequest({ exercise, notation, rendering: { format: "svg" } });
}

export const isScaleExerciseFamily = scaleFamily;
