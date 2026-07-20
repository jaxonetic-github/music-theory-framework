import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CANONICAL_EXERCISE_ROOTS } from "../src/core/index.js";
import { createWebApplication } from "../src/web/bootstrap.js";
import {
    buildExerciseApplicationRequest,
    createInitialExercisePracticeState,
    transitionExercisePracticeState
} from "../src/web/exercise/workflow.js";
import { validateExercisePresentation } from "../src/web/exercise/presentation.js";

const catalogs = Object.freeze({
    scales: Object.freeze([{ id: "major", name: "Major", memberCount: 7 }]),
    chords: Object.freeze([
        { id: "major", name: "Major", memberCount: 3 },
        { id: "major-7", name: "Major Seventh", memberCount: 4 }
    ])
});

test("exercise practice defaults and family transitions remove contradictory selections", () => {
    const initial = createInitialExercisePracticeState(catalogs);
    assert.equal(initial.pattern, "major");
    assert.equal("quality" in initial, false);
    const seventh = transitionExercisePracticeState(initial, { type: "arpeggio-seventh" }, catalogs);
    assert.equal(seventh.quality, "major-7");
    assert.equal("pattern" in seventh, false);
    const scale = transitionExercisePracticeState(seventh, { type: "scale-thirds" }, catalogs);
    assert.equal(scale.pattern, "major");
    assert.equal("quality" in scale, false);
});

test("root, all-key, and explicit-key transitions remove stale contradictions", () => {
    const initial = createInitialExercisePracticeState(catalogs);
    const all = transitionExercisePracticeState(initial, { allKeys: true }, catalogs);
    assert.equal("root" in all, false);
    const explicit = transitionExercisePracticeState(all, { keySignaturePolicy: "explicit" }, catalogs);
    assert.equal(explicit.keySignatureTonic, "C");
    const none = transitionExercisePracticeState(explicit, { keySignaturePolicy: "none" }, catalogs);
    assert.equal("keySignatureTonic" in none, false);
    assert.equal("keySignatureMode" in none, false);
});

test("request builder covers every family and preserves normalized immutable inputs", () => {
    for (const type of ["scale", "scale-thirds", "arpeggio-triad", "arpeggio-seventh", "chord-blocked", "chord-broken"]) {
        const scale = type.startsWith("scale");
        const request = buildExerciseApplicationRequest({
            type, root: " Cb ", allKeys: false, ...(scale ? { pattern: "major" } : { quality: type === "arpeggio-seventh" ? "major-7" : "major" }),
            direction: "ascending-descending", octaves: 2, startingOctave: 3, duration: "1/8", clef: "bass",
            beats: 3, beatUnit: 4, measuresPerSystem: 2, keySignaturePolicy: "none"
        });
        assert.equal(String(request.exercise.type), type);
        assert.equal(String(request.exercise.roots[0]), "Cb");
        assert.equal(request.exercise.pattern, scale ? "major" : null);
        assert.equal(request.exercise.quality, scale ? null : (type === "arpeggio-seventh" ? "major-7" : "major"));
        assert.equal(String(request.notation.duration), "1/8");
        assert.equal(String(request.notation.clef), "bass");
        assert.equal(request.notation.measuresPerSystem, 2);
        assert.equal(request.rendering.format, "svg");
        assert.equal(Object.isFrozen(request), true);
    }
});

test("all-key and key-signature policies are normalized deterministically", () => {
    const base = { type: "scale", root: "B#", allKeys: true, pattern: "major", direction: "ascending", octaves: 1, startingOctave: 4, duration: "1/4", clef: "treble", beats: 4, beatUnit: 4, measuresPerSystem: 4 };
    for (const policy of ["none", "exercise-root"]) {
        const request = buildExerciseApplicationRequest({ ...base, keySignaturePolicy: policy, keySignatureTonic: "Cb", keySignatureMode: "major" });
        assert.equal(request.exercise.allKeys, true);
        assert.deepEqual(request.exercise.roots.map(String), CANONICAL_EXERCISE_ROOTS);
        assert.equal(request.notation.keySignature, null);
    }
    const explicit = buildExerciseApplicationRequest({ ...base, allKeys: false, root: "B#", keySignaturePolicy: "explicit", keySignatureTonic: "Cb", keySignatureMode: "major" });
    assert.equal(String(explicit.exercise.roots[0]), "B#");
    assert.equal(String(explicit.notation.keySignature), "Cb major");
    assert.deepEqual(explicit, buildExerciseApplicationRequest({ ...base, allKeys: false, root: "B#", keySignaturePolicy: "explicit", keySignatureTonic: "Cb", keySignatureMode: "major" }));
});

test("trusted presentation validation accepts only internally consistent SVG results", async () => {
    const runtime = await createWebApplication();
    try {
        const result = runtime.exerciseApplication.run(buildExerciseApplicationRequest(createInitialExercisePracticeState(runtime.catalogs)));
        assert.strictEqual(validateExercisePresentation(result), result.presentation);
        const row = result.presentation.rows[0];
        const impostors = [
            { ...result, presentation: result.presentation },
            Object.create(result, { presentation: { value: { ...result.presentation, metadata: { rendering: { ...result.presentation.metadata.rendering, format: "html" } } } } })
        ];
        assert.throws(() => validateExercisePresentation(impostors[0]), /ExerciseApplicationResult/);
        assert.throws(() => validateExercisePresentation(impostors[1]), /supported SVG renderer/);
        assert.equal(row.mediaType, "image/svg+xml");
    } finally { await runtime.dispose(); }
});

test("Web namespace declares the exercise adapter boundary and Core stays React-free", async () => {
    const web = await readFile(new URL("../src/web/index.js", import.meta.url), "utf8");
    assert.match(web, /exercise\/index\.js/);
    const core = await readFile(new URL("../src/core/index.js", import.meta.url), "utf8");
    assert.doesNotMatch(core, /src\/web|ExercisePractice|react/i);
});

test("exercise adapter source has no playback, audio, download, MIDI, persistence, or network integration", async () => {
    const sources = await Promise.all(["workflow.js", "presentation.js", "useExercisePracticeWorkflow.js", "ExercisePracticePanel.jsx", "index.js"].map(file => readFile(new URL(`../src/web/exercise/${file}`, import.meta.url), "utf8")));
    const source = sources.join("\n");
    assert.doesNotMatch(source, /PlaybackEngine|PlaybackPlan|PlaybackTransport|AudioContext|createOscillator|createGain|Web MIDI|localStorage|indexedDB|downloadExport|fetch\s*\(/);
    assert.doesNotMatch(source, />\s*(?:Play|Stop|Pause|Replay|Loop)\s*</);
});
