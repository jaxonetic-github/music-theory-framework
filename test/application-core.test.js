import test from "node:test";
import assert from "node:assert/strict";

import {
    Application,
    ApplicationModule,
    ApplicationRequest,
    ApplicationResult,
    ApplicationWorkflowError,
    ExportModule,
    Kernel,
    MusicTheoryApplication,
    NotationModule,
    RenderingModule,
    RenderingOutput,
    RendererStrategy,
    ScoreGraph,
    TheoryModule,
    applicationCommandDescriptors,
    applicationPackageDescriptor,
    applicationServiceDescriptors
} from "../src/core/index.js";

async function fullKernel() {
    const kernel = new Kernel();
    kernel.use(new TheoryModule());
    kernel.use(new NotationModule());
    kernel.use(new RenderingModule());
    kernel.use(new ExportModule());
    kernel.use(new ApplicationModule());
    await kernel.start();
    return kernel;
}

const scaleRequest = (extra = {}) => ({
    type: "scale",
    root: "Eb",
    pattern: "major",
    notationOptions: { octave: 4 },
    ...extra
});

const chordRequest = (extra = {}) => ({
    type: "chord",
    root: "C#",
    quality: "major",
    notationOptions: { octave: 3 },
    ...extra
});

class TestPngRenderer extends RendererStrategy {
    constructor() { super({ id: "png", pluginId: "test.rendering.png", format: "png" }); }
    supports() { return true; }
    render() { return "PNG:test"; }
}

test("Application runs complete scale and chord generation-to-notation workflows", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const scale = app.run(scaleRequest());
    const chord = app.run(chordRequest());

    assert.equal(String(scale.generation.generatorId), "theory.scale-generator");
    assert.equal(String(chord.generation.generatorId), "theory.chord-generator");
    assert.ok(scale.score instanceof ScoreGraph);
    assert.ok(chord.score instanceof ScoreGraph);
    assert.equal(scale.rendering, null);
    assert.equal(scale.export, null);
    assert.equal(scale.metadata.generation.serviceId, "theory.scaleGenerator");
    assert.equal(chord.metadata.generation.serviceId, "theory.chordGenerator");
    await kernel.dispose();
});

test("Application optionally renders SVG, exports MusicXML, or performs both", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const rendering = { format: "svg", pluginId: "core.rendering.svg", strategyId: "svg" };
    const exporting = { format: "musicxml", pluginId: "core.export.musicxml", strategyId: "musicxml" };

    const svg = app.run(scaleRequest({ rendering }));
    const xml = app.run(scaleRequest({ export: exporting }));
    const both = app.run(scaleRequest({ rendering, export: exporting }));

    assert.match(svg.rendering.content, /^<svg /);
    assert.equal(svg.rendering.format, "svg");
    assert.match(xml.export.content, /^<\?xml /);
    assert.equal(xml.export.format, "musicxml");
    assert.match(both.rendering.content, /^<svg /);
    assert.match(both.export.content, /^<\?xml /);
    assert.equal(both.metadata.rendering.strategyId, "svg");
    assert.equal(both.metadata.export.strategyId, "musicxml");
    await kernel.dispose();
});

test("Application preserves enharmonic spelling and explicit note octaves end to end", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const cases = [
        ["Eb", ["Eb3", "G3", "Bb3"], "Eb", -1],
        ["F#", ["F#3", "A#3", "C#4"], "F#", 1],
        ["Cb", ["Cb3", "Eb3", "Gb3"], "Cb", -1],
        ["B#", ["B#3", "E4", "G4"], "B#", 1]
    ];
    for (const [root, notes, spelling, alteration] of cases) {
        const result = app.run({
            type: "chord", root, quality: "major",
            notationOptions: { notes },
            rendering: { format: "svg" },
            export: { format: "musicxml" }
        });
        assert.match(result.rendering.content, new RegExp(spelling.replace("#", "\\#")));
        assert.match(result.export.content, new RegExp(`<step>${spelling[0]}</step><alter>${alteration}</alter>`));
    }
    const explicit = app.run(chordRequest({ notationOptions: { notes: ["C#3", "E#3", "G#3"] } }));
    const pitches = explicit.score.nodes.filter(node => String(node.type) === "chord")[0].notes.map(note => note.toString());
    assert.deepEqual(pitches, ["C#3", "E#3", "G#3"]);
    await kernel.dispose();
});

test("Application passes plugin and strategy selections through all existing engines", async () => {
    const kernel = await fullKernel();
    const result = kernel.services.resolve("application.engine").run(chordRequest({
        notationOptions: { pluginId: "core.notation.defaults", strategyId: "chord", octave: 4 },
        rendering: { format: "svg", pluginId: "core.rendering.svg", strategyId: "svg", options: { width: 720 } },
        export: { format: "musicxml", pluginId: "core.export.musicxml", strategyId: "musicxml" }
    }));
    assert.deepEqual(result.metadata.notation, {
        serviceId: "notation.engine", pluginId: "core.notation.defaults", strategyId: "chord"
    });
    assert.equal(result.metadata.rendering.pluginId, "core.rendering.svg");
    assert.equal(result.metadata.export.pluginId, "core.export.musicxml");
    assert.match(result.rendering.content, /width="720"/);
    await kernel.dispose();
});

test("Application rendering requests select and report the renderer matching normalized format", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const rendering = kernel.services.resolve("rendering.engine");
    rendering.registry.register("test.rendering.png", new TestPngRenderer());

    const png = app.run(scaleRequest({ rendering: { format: " PNG " } }));
    assert.equal(png.rendering.format, "png");
    assert.equal(png.rendering.content, "PNG:test");
    assert.equal(png.metadata.rendering.pluginId, "test.rendering.png");
    assert.equal(png.metadata.rendering.strategyId, "png");

    const svg = app.run(scaleRequest({ rendering: { format: "SVG" } }));
    assert.match(svg.rendering.content, /^<svg /);
    assert.equal(svg.metadata.rendering.pluginId, "core.rendering.svg");
    assert.equal(svg.metadata.rendering.strategyId, "svg");

    assert.throws(
        () => app.run(scaleRequest({ rendering: { format: "unknown" } })),
        error => error.stage === "rendering" && /No renderer strategy/.test(error.cause.message)
    );
    assert.throws(
        () => app.run(scaleRequest({ rendering: {
            format: "png", pluginId: "core.rendering.svg", strategyId: "svg"
        } })),
        error => error.stage === "rendering"
            && /produces "svg", not requested format "png"/.test(error.cause.message)
    );
    await kernel.dispose();
});

test("Rendering and Export consume the exact same ScoreGraph and Export never consumes SVG", async () => {
    const kernel = await fullKernel();
    const realRenderer = kernel.services.resolve("rendering.engine");
    const realExporter = kernel.services.resolve("export.engine");
    const inputs = [];
    kernel.services.register("rendering.engine", {
        registry: realRenderer.registry,
        render(score, options) { inputs.push(["render", score]); return realRenderer.render(score, options); }
    }, { replace: true });
    kernel.services.register("export.engine", {
        registry: realExporter.registry,
        export(score, format, options) {
            assert.ok(score instanceof ScoreGraph);
            inputs.push(["export", score]);
            return realExporter.export(score, format, options);
        }
    }, { replace: true });

    const result = kernel.services.resolve("application.engine").run(scaleRequest({
        rendering: { format: "svg" }, export: { format: "musicxml" }
    }));
    assert.strictEqual(inputs[0][1], result.score);
    assert.strictEqual(inputs[1][1], result.score);
    await kernel.dispose();
});

test("Repeated identical workflows are deterministic and preserve immutable domain references", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const input = scaleRequest({ rendering: { format: "svg" }, export: { format: "musicxml" } });
    const before = structuredClone(input);
    const first = app.run(input);
    const second = app.run(input);

    assert.deepEqual(input, before);
    assert.deepEqual(first.request, second.request);
    assert.deepEqual(first.generation, second.generation);
    assert.deepEqual(first.score, second.score);
    assert.equal(first.rendering.content, second.rendering.content);
    assert.equal(first.export.content, second.export.content);
    assert.deepEqual(first.metadata, second.metadata);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.request));
    assert.ok(Object.isFrozen(first.metadata));
    assert.strictEqual(first.generation, first.generation);
    assert.throws(() => { first.metadata.generation.serviceId = "changed"; }, TypeError);
    await kernel.dispose();
});

test("ApplicationRequest rejects malformed, contradictory, and unknown workflow values", () => {
    const invalid = [
        {},
        { type: "unknown", root: "C", pattern: "major" },
        { type: "scale", root: "C", quality: "major" },
        { type: "scale", root: "C", pattern: "major", quality: "major" },
        { type: "chord", root: "C", pattern: "major" },
        { type: "chord", root: "C", quality: "major", extra: true },
        { type: "scale", root: "C", pattern: "major", generationOptions: [] },
        { type: "scale", root: "C", pattern: "major", rendering: {} },
        { type: "scale", root: "C", pattern: "major", rendering: { format: "svg", strategyId: "svg" } },
        { type: "scale", root: "C", pattern: "major", export: { format: "musicxml", unknown: true } }
    ];
    for (const request of invalid) assert.throws(() => new ApplicationRequest(request));
});

test("Every missing workflow service reports its stage and preserves its cause", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const cases = [
        ["theory.scaleGenerator", "generation", scaleRequest()],
        ["theory.chordGenerator", "generation", chordRequest()],
        ["notation.engine", "notation", scaleRequest()],
        ["rendering.engine", "rendering", scaleRequest({ rendering: { format: "svg" } })],
        ["export.engine", "export", scaleRequest({ export: { format: "musicxml" } })]
    ];
    for (const [serviceId, stage, request] of cases) {
        const value = kernel.services.resolve(serviceId);
        kernel.services.unregister(serviceId);
        assert.throws(() => app.run(request), error => {
            assert.ok(error instanceof ApplicationWorkflowError);
            assert.equal(error.stage, stage);
            assert.ok(error.cause instanceof Error);
            return true;
        });
        kernel.services.register(serviceId, value);
    }
    await kernel.dispose();
});

test("Stage failures preserve causes and never return or continue with partial results", async () => {
    const kernel = await fullKernel();
    const app = kernel.services.resolve("application.engine");
    const renderer = kernel.services.resolve("rendering.engine");
    const exporter = kernel.services.resolve("export.engine");
    const cause = new Error("renderer exploded");
    let exportCalls = 0;
    kernel.services.register("rendering.engine", { render() { throw cause; } }, { replace: true });
    kernel.services.register("export.engine", { export() { exportCalls += 1; } }, { replace: true });
    assert.throws(
        () => app.run(scaleRequest({ rendering: { format: "svg" }, export: { format: "musicxml" } })),
        error => error.stage === "rendering" && error.cause === cause
    );
    assert.equal(exportCalls, 0);

    kernel.services.register("rendering.engine", renderer, { replace: true });
    const exportCause = new Error("exporter exploded");
    kernel.services.register("export.engine", { export() { throw exportCause; } }, { replace: true });
    assert.throws(
        () => app.run(scaleRequest({ rendering: { format: "svg" }, export: { format: "musicxml" } })),
        error => error.stage === "export" && error.cause === exportCause
    );
    kernel.services.register("export.engine", exporter, { replace: true });
    await kernel.dispose();
});

test("ApplicationModule registers its service, descriptor, and thin workflow command", async () => {
    const kernel = new Kernel();
    const module = new ApplicationModule({ engine: { run: request => ({ delegated: request }) } });
    kernel.use(module);
    await kernel.start();
    assert.strictEqual(kernel.services.resolve("application.engine"), module.engine);
    assert.strictEqual(kernel.registries.services.resolve("application.engine"), module.engine);
    assert.deepEqual(await kernel.commands.execute("application.runWorkflow", { value: 1 }), { delegated: { value: 1 } });
    await kernel.dispose();
});

test("ApplicationModule rolls back and preserves pre-existing values at every collision point", () => {
    for (const collision of ["container", "registry", "command"]) {
        const kernel = new Kernel();
        const existing = collision === "command" ? () => collision : { collision };
        if (collision === "container") kernel.services.register("application.engine", existing);
        if (collision === "registry") kernel.registries.services.register(applicationServiceDescriptors.engine, { value: existing });
        if (collision === "command") kernel.commands.register("application.runWorkflow", existing);
        const module = new ApplicationModule();
        assert.throws(() => module.configure(kernel));
        assert.strictEqual(kernel.services.resolve("application.engine", { optional: true }), collision === "container" ? existing : null);
        assert.strictEqual(kernel.registries.services.resolve("application.engine"), collision === "registry" ? existing : null);
        if (collision === "command") assert.equal(kernel.commands.has("application.runWorkflow"), true);
        else assert.equal(kernel.commands.has("application.runWorkflow"), false);
    }
});

test("ApplicationModule preserves same-object collisions and rolls back earlier transaction steps", () => {
    for (const collision of ["container", "registry", "command"]) {
        const kernel = new Kernel();
        const module = new ApplicationModule();
        if (collision === "container") kernel.services.register("application.engine", module.engine);
        if (collision === "registry") kernel.registries.services.register(applicationServiceDescriptors.engine, { value: module.engine });
        if (collision === "command") kernel.commands.register("application.runWorkflow", module.workflowHandler);
        assert.throws(() => module.configure(kernel));
        assert.strictEqual(kernel.services.resolve("application.engine", { optional: true }), collision === "container" ? module.engine : null);
        assert.strictEqual(kernel.registries.services.resolve("application.engine"), collision === "registry" ? module.engine : null);
        if (collision === "command") assert.equal(kernel.commands.has("application.runWorkflow"), true);
    }
});

test("ApplicationModule removes listener-failed insertion and rolls back earlier registrations", () => {
    const kernel = new Kernel();
    const module = new ApplicationModule();
    const unsubscribe = kernel.registries.services.subscribe(() => { throw new Error("listener failed"); });
    assert.throws(() => module.configure(kernel), /listener failed/);
    unsubscribe();
    assert.equal(kernel.services.resolve("application.engine", { optional: true }), null);
    assert.equal(kernel.registries.services.has("application.engine"), false);
    assert.equal(kernel.commands.has("application.runWorkflow"), false);
});

test("ApplicationModule configure/dispose is reusable, idempotent, and preserves replacements", async () => {
    const kernel = new Kernel();
    const module = new ApplicationModule();
    module.configure(kernel);
    module.configure(kernel);
    const replacementService = { replacement: "container" };
    const replacementRegistry = { replacement: "registry" };
    const replacementCommand = () => "replacement";
    kernel.services.register("application.engine", replacementService, { replace: true });
    kernel.registries.services.register(applicationServiceDescriptors.engine, { value: replacementRegistry, replace: true });
    kernel.commands.unregister("application.runWorkflow");
    kernel.commands.register("application.runWorkflow", replacementCommand);
    module.dispose();
    module.dispose();
    assert.strictEqual(kernel.services.resolve("application.engine"), replacementService);
    assert.strictEqual(kernel.registries.services.resolve("application.engine"), replacementRegistry);
    assert.equal(await kernel.commands.execute("application.runWorkflow"), "replacement");

    kernel.services.unregister("application.engine");
    kernel.registries.services.unregister("application.engine");
    kernel.commands.unregister("application.runWorkflow");
    module.configure(kernel);
    assert.strictEqual(kernel.services.resolve("application.engine"), module.engine);
    module.dispose();
});

test("Application result contracts and public namespace expose the v7.1 boundary", () => {
    assert.equal(Application.MusicTheoryApplication, MusicTheoryApplication);
    assert.equal(Application.ApplicationResult, ApplicationResult);
    assert.equal(Application.RenderingOutput, RenderingOutput);
    assert.equal(String(applicationPackageDescriptor.id), "core.application");
    assert.equal(String(applicationServiceDescriptors.engine.id), "application.engine");
    assert.equal(String(applicationCommandDescriptors.runWorkflow.id), "application.runWorkflow");
    assert.equal(Object.isFrozen(Application), true);
    assert.equal("download" in Application, false);
    assert.equal("filesystem" in Application, false);
});
