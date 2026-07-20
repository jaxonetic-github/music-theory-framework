import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { ApplicationRequest, ApplicationResult, ExportResult, Kernel, PlaybackPlan, PlaybackRequest } from "../src/core/index.js";
import { createWebApplication } from "../src/web/bootstrap.js";
import { downloadExport, exportFilenameBase, safeFilename } from "../src/web/download.js";
import { reactWebPackageDescriptor } from "../src/web/package.descriptor.js";
import { buildWorkflowRequest, createInitialWorkflowState, transitionWorkflow } from "../src/web/workflow.js";

test("web bootstrap installs and resolves the complete application workflow", async () => {
    const kernel = new Kernel({ name: "web-test" });
    const runtime = await createWebApplication({ kernel });
    assert.strictEqual(runtime.application, kernel.services.resolve("application.engine"));
    assert.strictEqual(runtime.exerciseApplication, kernel.services.resolve("exercise.application.engine"));
    assert.strictEqual(runtime.playback, kernel.services.resolve("playback.engine"));
    assert.strictEqual(runtime.transport, kernel.services.resolve("web.playback.transport"));
    assert.deepEqual(kernel.modules.map(module => module.id), [
        "core.theory", "core.notation", "core.rendering", "core.exercise", "core.exercise-notation",
        "core.exercise-application", "core.export", "core.application",
        "core.playback", "web.audio-playback", "web.playback-transport"
    ]);
    assert.strictEqual(runtime.transport.plan, null);
    assert.equal(globalThis.AudioContext, undefined);
    assert.ok(runtime.catalogs.scales.some(pattern => pattern.id === "major"));
    assert.ok(runtime.catalogs.chords.some(pattern => pattern.id === "minor-7"));
    assert.equal(Object.isFrozen(runtime.catalogs), true);
    await runtime.dispose();
    await runtime.dispose();
    assert.equal(String(kernel.state), "disposed");
});

test("web bootstrap disposes initialized resources after a startup failure", async () => {
    let disposeCalls = 0;
    const kernel = {
        use() { return this; },
        async start() { throw new Error("startup failed"); },
        async dispose() { disposeCalls += 1; }
    };
    await assert.rejects(() => createWebApplication({ kernel, modules: [{ id: "test.module" }] }), /startup failed/);
    assert.equal(disposeCalls, 1);
});

test("web bootstrap owns audio lazily while transport borrows it and runtime disposal closes it once", async () => {
    const previous = globalThis.AudioContext;
    let constructions = 0;
    let closes = 0;
    class RuntimeAudioContext {
        constructor() { constructions += 1; this.state = "running"; this.currentTime = 0; this.destination = {}; }
        createOscillator() { return {}; }
        createGain() { return {}; }
        async close() { closes += 1; this.state = "closed"; }
    }
    globalThis.AudioContext = RuntimeAudioContext;
    try {
        const runtime = await createWebApplication();
        assert.equal(constructions, 0);
        const empty = new PlaybackPlan({
            request: new PlaybackRequest(), resolution: 1, events: [], totalTicks: 0,
            metadata: { pluginId: "core.playback.score", strategyId: "score" }
        });
        runtime.transport.load(empty);
        await runtime.transport.play();
        assert.equal(constructions, 1);
        assert.equal(runtime.transport.snapshot.state, "completed");
        await runtime.dispose();
        await runtime.dispose();
        assert.equal(runtime.transport.snapshot.state, "disposed");
        assert.equal(closes, 1);
    } finally {
        if (previous === undefined) delete globalThis.AudioContext;
        else globalThis.AudioContext = previous;
    }
});

test("workflow state derives defaults from catalogs and removes contradictory selections", () => {
    const catalogs = {
        scales: [{ id: "catalog-scale", name: "Catalog Scale" }],
        chords: [{ id: "catalog-chord", name: "Catalog Chord" }]
    };
    const initial = createInitialWorkflowState(catalogs);
    assert.equal(initial.pattern, "catalog-scale");
    assert.equal("quality" in initial, false);
    const chord = transitionWorkflow(initial, { type: "chord" }, catalogs);
    assert.equal(chord.quality, "catalog-chord");
    assert.equal("pattern" in chord, false);
    const scale = transitionWorkflow(chord, { type: "scale" }, catalogs);
    assert.equal(scale.pattern, "catalog-scale");
    assert.equal("quality" in scale, false);
});

test("request builder produces deterministic validated scale and chord requests", () => {
    const scale = buildWorkflowRequest({
        type: "scale", root: " Eb ", pattern: "dorian", octave: 5,
        renderingEnabled: true, exportEnabled: false
    });
    assert.equal(scale.root, "Eb");
    assert.equal(scale.pattern, "dorian");
    assert.equal(scale.quality, null);
    assert.equal(scale.notationOptions.octave, 5);
    assert.equal(scale.rendering.format, "svg");
    assert.equal(scale.export, null);

    const chordState = {
        type: "chord", root: "B#", quality: "major-7", octave: 3,
        renderingEnabled: false, exportEnabled: true
    };
    const chord = buildWorkflowRequest(chordState);
    assert.equal(chord.quality, "major-7");
    assert.equal(chord.pattern, null);
    assert.equal(chord.rendering, null);
    assert.equal(chord.export.format, "musicxml");
    assert.deepEqual(chord, buildWorkflowRequest(chordState));
});

test("MusicXML download uses immutable export data and always revokes its object URL", () => {
    const result = new ExportResult({
        format: "musicxml", mediaType: "application/vnd.recordare.musicxml+xml",
        extension: "musicxml", content: "<score-partwise/>"
    });
    const calls = [];
    class FakeBlob {
        constructor(parts, options) { calls.push(["blob", parts, options]); }
    }
    const anchor = {
        hidden: false,
        click() { calls.push(["click", this.download]); },
        remove() { calls.push(["remove"]); }
    };
    const documentObject = {
        createElement(tag) { assert.equal(tag, "a"); return anchor; },
        body: { append(value) { assert.strictEqual(value, anchor); calls.push(["append"]); } }
    };
    const urlObject = {
        createObjectURL() { calls.push(["create-url"]); return "blob:test"; },
        revokeObjectURL(url) { calls.push(["revoke", url]); }
    };
    downloadExport(result, { filenameBase: "Cb Major / Study", documentObject, urlObject, BlobType: FakeBlob });
    assert.equal(anchor.href, "blob:test");
    assert.equal(anchor.download, "cb-major-study.musicxml");
    assert.deepEqual(calls[0], ["blob", ["<score-partwise/>"], { type: result.mediaType }]);
    assert.deepEqual(calls.at(-1), ["revoke", "blob:test"]);
    assert.throws(() => downloadExport(null, { documentObject, urlObject, BlobType: FakeBlob }), /ExportResult/);
    assert.equal(safeFilename("../../"), "music-theory");
});

test("MusicXML object URL is revoked even when the browser click fails", () => {
    const result = new ExportResult({ format: "musicxml", mediaType: "application/xml", extension: "xml", content: "<x/>" });
    let revoked = false;
    const anchor = { click() { throw new Error("blocked"); }, remove() {} };
    assert.throws(() => downloadExport(result, {
        documentObject: { createElement: () => anchor, body: { append() {} } },
        urlObject: { createObjectURL: () => "blob:failed", revokeObjectURL: () => { revoked = true; } },
        BlobType: class {}
    }), /blocked/);
    assert.equal(revoked, true);
});

test("export filename identity comes from the completed immutable workflow request", async () => {
    const runtime = await createWebApplication();
    const chord = runtime.application.run({
        type: "chord", root: "C", quality: "major", notationOptions: { octave: 4 },
        export: { format: "musicxml" }
    });
    assert.equal(exportFilenameBase(chord), "c-chord");

    const unsafeRequest = new ApplicationRequest({
        type: "chord", root: "../../Unsafe Root", quality: "major",
        export: { format: "musicxml" }
    });
    const unsafe = new ApplicationResult({
        request: unsafeRequest,
        generation: chord.generation,
        score: chord.score,
        exported: chord.export
    });
    assert.equal(exportFilenameBase(unsafe), "unsafe-root-chord");
    assert.throws(() => exportFilenameBase({ request: unsafeRequest, export: chord.export }), /ApplicationResult/);
    await runtime.dispose();
});

test("core public entry remains free of React and DOM imports", async () => {
    const source = await readFile(new URL("../src/core/index.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /react|react-dom|document|window/i);
    const core = await import("../src/core/index.js");
    assert.equal(typeof core.Kernel, "function");
    assert.equal("MusicTheoryWebApp" in core, false);
    assert.equal(String(reactWebPackageDescriptor.id), "web.react-application");
    assert.equal(String(reactWebPackageDescriptor.version), "8.3.0");
    assert.ok(reactWebPackageDescriptor.capabilities.values.some(capability => String(capability.id) === "accessible-exercise-practice"));
    assert.ok(reactWebPackageDescriptor.capabilities.values.some(capability => String(capability.id) === "accessible-playback-controls"));
});
