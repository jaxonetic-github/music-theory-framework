import {
    APPROACH_PATTERNS,
    CHORD_TARGETS,
    ENCLOSURE_PATTERNS,
    EXERCISE_DIRECTIONS,
    EXERCISE_TYPES,
    ExerciseApplicationRequest
} from "../../core/index.js";

const SCALE_FAMILIES = Object.freeze(["scale", "scale-thirds"]);
const FOUNDATIONAL_CHORD_FAMILIES = Object.freeze(["arpeggio-triad", "arpeggio-seventh", "chord-blocked", "chord-broken"]);
const TARGET_FAMILIES = Object.freeze(["approach-note", "enclosure"]);
const ADVANCED_FAMILIES = Object.freeze([...TARGET_FAMILIES, "chord-progression"]);

export const exerciseFamilyOptions = Object.freeze([
    ["scale", "Scale"], ["scale-thirds", "Scale in thirds"],
    ["arpeggio-triad", "Triad arpeggio"], ["arpeggio-seventh", "Seventh arpeggio"],
    ["chord-blocked", "Blocked chord"], ["chord-broken", "Broken chord"],
    ["approach-note", "Approach note"], ["enclosure", "Enclosure"], ["chord-progression", "Chord progression"]
].map(([id, label]) => Object.freeze({ id, label })));
export const advancedExerciseFamilyOptions = Object.freeze(exerciseFamilyOptions.filter(option => ADVANCED_FAMILIES.includes(option.id)));
export const exerciseDirectionOptions = Object.freeze(EXERCISE_DIRECTIONS.map(id => Object.freeze({ id, label: id.replaceAll("-", " ") })));
export const exerciseDurationOptions = Object.freeze([
    { id: "1/2", label: "Half note" }, { id: "1/4", label: "Quarter note" },
    { id: "1/8", label: "Eighth note" }, { id: "1/16", label: "Sixteenth note" }
].map(Object.freeze));

export function advancedPatternLabel(value) {
    const tokens = String(value).split("-");
    const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
    if (tokens.length === 4) return `${capitalize(tokens.slice(0, 2).join(" "))}, ${tokens.slice(2).join(" ")}`;
    if (tokens.length === 3) return `${capitalize(tokens.slice(0, 2).join(" "))}, ${tokens[2]}`;
    return capitalize(tokens.join(" "));
}

export const approachPatternOptions = Object.freeze(APPROACH_PATTERNS.map(id => Object.freeze({ id, label: advancedPatternLabel(id) })));
export const enclosurePatternOptions = Object.freeze(ENCLOSURE_PATTERNS.map(id => Object.freeze({ id, label: advancedPatternLabel(id) })));
export const chordTargetOptions = Object.freeze(CHORD_TARGETS.map(id => Object.freeze({ id, label: id.charAt(0).toUpperCase() + id.slice(1) })));

const scaleFamily = type => SCALE_FAMILIES.includes(type);
const targetFamily = type => TARGET_FAMILIES.includes(type);
const progressionFamily = type => type === "chord-progression";
const advancedFamily = type => ADVANCED_FAMILIES.includes(type);
const chordCount = type => type === "arpeggio-triad" ? 3 : type === "arpeggio-seventh" ? 4 : null;
const first = (values, label) => {
    const value = values?.[0]?.id;
    if (!value) throw new Error(`The ${label} catalog has no compatible choices.`);
    return String(value);
};
const hasChoice = (values, id) => values?.some(value => value.id === id) ?? false;

export function exerciseChoicesForFamily(catalogs, type) {
    if (scaleFamily(type)) return catalogs.scales;
    if (progressionFamily(type)) return catalogs.progressions;
    const count = chordCount(type);
    return count ? catalogs.chords.filter(value => value.memberCount === count) : catalogs.chords;
}

export function exerciseTargetChoices(catalogs, quality) {
    const chord = catalogs?.chords?.find(value => value.id === quality);
    if (!chord || !Array.isArray(chord.memberRoles)) throw new Error(`Chord quality "${String(quality)}" is unavailable for advanced targets.`);
    const roles = new Set(chord.memberRoles);
    return Object.freeze(chordTargetOptions.filter(option => option.id === "all" || roles.has({ root: 1, third: 3, fifth: 5, seventh: 7 }[option.id])));
}

export function createInitialExercisePracticeState(catalogs) {
    return Object.freeze({
        type: "scale", root: "C", allKeys: false, pattern: first(catalogs.scales, "scale"),
        direction: "ascending", octaves: 1, startingOctave: 4, duration: "1/4", clef: "treble",
        beats: 4, beatUnit: 4, measuresPerSystem: 4, keySignaturePolicy: "none"
    });
}

function clearAdvanced(next) {
    delete next.target; delete next.approachPattern; delete next.enclosurePattern; delete next.progression;
}

export function transitionExercisePracticeState(state, change, catalogs) {
    if (!change || typeof change !== "object" || Array.isArray(change)) throw new TypeError("An exercise state change must be an object.");
    const next = { ...state, ...change };
    if (change.type !== undefined) {
        const type = String(change.type);
        if (!EXERCISE_TYPES.includes(type)) throw new TypeError(`Unsupported exercise family: ${type}.`);
        next.type = type;
        if (scaleFamily(type)) {
            delete next.quality; clearAdvanced(next);
            if (!hasChoice(catalogs.scales, next.pattern)) next.pattern = first(catalogs.scales, "scale");
        } else if (targetFamily(type)) {
            delete next.pattern; delete next.progression;
            if (!hasChoice(catalogs.chords, next.quality)) next.quality = hasChoice(catalogs.chords, "major") ? "major" : first(catalogs.chords, "chord");
            const targets = exerciseTargetChoices(catalogs, next.quality);
            next.target = hasChoice(targets, next.target) ? next.target : (hasChoice(targets, "root") ? "root" : first(targets, "target"));
            if (type === "approach-note") {
                delete next.enclosurePattern;
                next.approachPattern = APPROACH_PATTERNS.includes(next.approachPattern) ? next.approachPattern : "chromatic-below";
            } else {
                delete next.approachPattern;
                next.enclosurePattern = ENCLOSURE_PATTERNS.includes(next.enclosurePattern) ? next.enclosurePattern : "diatonic-above-chromatic-below";
            }
        } else if (progressionFamily(type)) {
            delete next.pattern; delete next.quality; delete next.target; delete next.approachPattern; delete next.enclosurePattern;
            if (!hasChoice(catalogs.progressions, next.progression)) next.progression = first(catalogs.progressions, "progression");
        } else if (FOUNDATIONAL_CHORD_FAMILIES.includes(type)) {
            delete next.pattern; clearAdvanced(next);
            const choices = exerciseChoicesForFamily(catalogs, type);
            if (!hasChoice(choices, next.quality)) next.quality = first(choices, "chord");
        }
    }
    if (targetFamily(next.type) && change.quality !== undefined) {
        if (!hasChoice(catalogs.chords, next.quality)) throw new Error(`Chord quality "${String(next.quality)}" is unavailable.`);
        const targets = exerciseTargetChoices(catalogs, next.quality);
        if (!hasChoice(targets, next.target)) next.target = hasChoice(targets, "root") ? "root" : first(targets, "target");
    }
    if (advancedFamily(next.type)) { next.direction = "ascending"; next.octaves = 1; }
    else if (!EXERCISE_DIRECTIONS.includes(next.direction)) next.direction = "ascending";
    if (next.allKeys) delete next.root;
    else if (state.allKeys && change.allKeys === false && !String(next.root ?? "").trim()) next.root = "C";
    if (next.keySignaturePolicy !== "explicit") {
        delete next.keySignatureTonic; delete next.keySignatureMode;
    } else {
        next.keySignatureTonic ??= "C"; next.keySignatureMode ??= "major";
    }
    return Object.freeze(next);
}

function duration(value) {
    const match = /^(\d+)\/(\d+)$/.exec(String(value));
    if (!match) throw new TypeError("Notation duration must use numerator/denominator form.");
    return Object.freeze({ numerator: Number(match[1]), denominator: Number(match[2]) });
}

export function buildExerciseApplicationRequest(state, catalogs = null) {
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("Exercise practice state must be an object.");
    const type = String(state.type ?? "");
    if (!EXERCISE_TYPES.includes(type)) throw new TypeError("Select a supported exercise family.");
    const allKeys = Boolean(state.allKeys);
    const exercise = { type, allKeys, ...(!allKeys ? { root: String(state.root ?? "").trim() } : {}), startingOctave: Number(state.startingOctave) };
    if (scaleFamily(type)) Object.assign(exercise, { pattern: String(state.pattern ?? "").trim(), direction: String(state.direction ?? "ascending"), octaves: Number(state.octaves) });
    else if (targetFamily(type)) {
        if (!catalogs) throw new TypeError("Advanced target requests require active catalog choices.");
        const quality = String(state.quality ?? "").trim(), target = String(state.target ?? "").trim();
        if (!hasChoice(exerciseTargetChoices(catalogs, quality), target)) throw new TypeError(`Target "${target}" is unavailable for chord quality "${quality}".`);
        Object.assign(exercise, { quality, target, ...(type === "approach-note" ? { approachPattern: String(state.approachPattern ?? "").trim() } : { enclosurePattern: String(state.enclosurePattern ?? "").trim() }), direction: "ascending", octaves: 1 });
    } else if (progressionFamily(type)) {
        if (!catalogs?.progressions || !hasChoice(catalogs.progressions, state.progression)) throw new TypeError("Select an available chord progression.");
        Object.assign(exercise, { progression: String(state.progression), direction: "ascending", octaves: 1 });
    } else Object.assign(exercise, { quality: String(state.quality ?? "").trim(), direction: String(state.direction ?? "ascending"), octaves: Number(state.octaves) });
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
export const isTargetExerciseFamily = targetFamily;
export const isProgressionExerciseFamily = progressionFamily;
export const isAdvancedExerciseFamily = advancedFamily;
