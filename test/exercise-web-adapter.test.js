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
        assert.throws(() => validateExercisePresentation(impostors[1]), /approved internal SVG renderer/);
        assert.equal(row.mediaType, "image/svg+xml");
    } finally { await runtime.dispose(); }
});

test("trusted presentation rejects unapproved renderers and every active or external SVG construct", async () => {
    const runtime = await createWebApplication();
    try {
        const result = runtime.exerciseApplication.run(buildExerciseApplicationRequest(createInitialExercisePracticeState(runtime.catalogs)));
        const sourceRow = result.presentation.rows[0];
        const sourceSection = result.presentation.sections[0];
        const forge = ({ content = sourceRow.content, documentRenderer = {}, rowRenderer = {} } = {}) => {
            const renderer = { ...result.presentation.metadata.rendering, ...documentRenderer };
            const row = Object.create(sourceRow, {
                content: { value: content },
                rendererPluginId: { value: rowRenderer.pluginId ?? sourceRow.rendererPluginId },
                rendererStrategyId: { value: rowRenderer.strategyId ?? sourceRow.rendererStrategyId },
                metadata: { value: { ...sourceRow.metadata, renderer: { ...sourceRow.metadata.renderer, ...rowRenderer } } }
            });
            const section = Object.create(sourceSection, { rows: { value: [row] } });
            const presentation = Object.create(result.presentation, {
                metadata: { value: { ...result.presentation.metadata, rendering: renderer } },
                sections: { value: [section] }
            });
            return Object.create(result, { presentation: { value: presentation } });
        };
        for (const renderer of [{ pluginId: "third.party.svg" }, { strategyId: "custom" }]) {
            assert.throws(() => validateExercisePresentation(forge({ documentRenderer: renderer })), /approved internal SVG renderer/);
            assert.throws(() => validateExercisePresentation(forge({ rowRenderer: renderer })), /renderer metadata/);
        }
        const payloads = [
            '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.test/x">x</a></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="http://example.test/x"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">x</a></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,x"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><use href="//example.test/x"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:url(#x)}</style></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "theme.css"</style></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><g onclick="alert(1)"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><iframe/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><object/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><embed/></svg>',
            '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>',
            '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'
        ];
        for (const content of payloads) assert.throws(() => validateExercisePresentation(forge({ content })), /trusted internal SVG/);
        const safeFragment = sourceRow.content.replace("<svg ", '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ').replace("</svg>", '<use href="#score-title" xlink:href="#score-title"/></svg>');
        assert.strictEqual(validateExercisePresentation(forge({ content: safeFragment })).id, result.presentation.id);
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
