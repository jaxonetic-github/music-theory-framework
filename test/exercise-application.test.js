import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    ApplicationModule, ChordNode, Exercise, ExerciseApplication, ExerciseApplicationEngine, ExerciseApplicationModule,
    ExerciseApplicationRequest, ExerciseApplicationResult, ExerciseApplicationWorkflowError, ExerciseModel, ExerciseModule,
    ExerciseNotationDocument, ExerciseNotationModule, ExercisePresentationDocument, ExercisePresentationRow, ExercisePresentationSection,
    ExercisePresentationSystem, ExerciseSection, Kernel, MusicTheoryApplication, NotationModule, NoteNode, PlaybackModule,
    RendererStrategy, RenderingModule, ScoreGraph, TheoryModule, ValidationError
} from "../src/core/index.js";

async function runtime() {
    const kernel = new Kernel().use(new TheoryModule()).use(new NotationModule()).use(new RenderingModule()).use(new ExerciseModule()).use(new ExerciseNotationModule()).use(new ExerciseApplicationModule());
    await kernel.start(); return { kernel, engine: kernel.services.resolve("exercise.application.engine") };
}

test("ExerciseRequest flows through generation, notation, rendering, and immutable presentation", async () => {
    const { engine } = await runtime(); const input = { exercise: { type: "scale", root: "Cb", octaves: 2 }, notation: { measuresPerSystem: 3 }, rendering: { format: "SVG" } }; const before = JSON.stringify(input);
    const result = engine.run(input); assert.ok(result instanceof ExerciseApplicationResult); assert.ok(result.notationDocument instanceof ExerciseNotationDocument); assert.ok(result.presentation instanceof ExercisePresentationDocument);
    assert.equal(JSON.stringify(input), before); assert.strictEqual(result.presentation.model, result.model); assert.strictEqual(result.presentation.notationDocument, result.notationDocument);
    assert.equal(result.presentation.rows.length, result.model.rows.length); assert.deepEqual(result.presentation.rows.map(row => String(row.root)), result.model.rows.map(row => String(row.root)));
    const row = result.presentation.rows[0]; assert.ok(row instanceof ExercisePresentationRow); assert.strictEqual(row.sourceRow, result.model.rows[0]); assert.strictEqual(row.notationRow, result.notationDocument.rows[0]); assert.strictEqual(row.graph, row.notationRow.graph);
    assert.equal(row.format, "svg"); assert.equal(row.mediaType, "image/svg+xml"); assert.equal(row.rendererPluginId, "core.rendering.svg"); assert.equal(row.rendererStrategyId, "svg"); assert.match(row.content, /<svg/); assert.equal(String(row.graph.nodesOfType("note")[0].pitch), "Cb4");
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.metadata) && Object.isFrozen(result.presentation) && Object.isFrozen(result.presentation.sections) && Object.isFrozen(row) && Object.isFrozen(row.systems));
});

test("supplied ExerciseModel bypasses generation and preserves exact identity", async () => {
    const { kernel } = await runtime(); const model = kernel.services.resolve("exercise.engine").generate({ type: "scale-thirds", root: "F#" }); let calls = 0;
    const engine = new ExerciseApplicationEngine({ exerciseEngine: { generate() { calls += 1; throw new Error("must not generate"); } }, notationEngine: kernel.services.resolve("exercise.notation.engine"), renderingEngine: kernel.services.resolve("rendering.engine") });
    const before = JSON.stringify(model), result = engine.run({ model }); assert.equal(calls, 0); assert.strictEqual(result.model, model); assert.strictEqual(result.notationDocument.model, model); assert.equal(JSON.stringify(model), before); assert.equal(result.metadata.generationBypassed, true);
    const first = result.presentation.rows[0].graph.nodesOfType("note"); assert.equal(first[0].metadata.attributes.stepId, first[1].metadata.attributes.stepId); assert.notEqual(String(first[0].id), String(first[1].id));
    for (const invalid of [{ model, exercise: {} }, { model, type: "scale" }, { model: {} }]) assert.throws(() => new ExerciseApplicationRequest(invalid), ValidationError);
});

test("exercise families preserve event shape, member order, precedence, and spelling", async () => {
    const { engine } = await runtime();
    const blocked = engine.run({ exercise: { type: "chord-blocked", root: "Eb", quality: "major" } }).presentation.rows[0]; const chord = blocked.graph.nodesOfType("chord")[0]; assert.ok(chord instanceof ChordNode); assert.deepEqual(chord.notes.map(String), ["Eb4", "G4", "Bb4"]); assert.deepEqual(chord.metadata.attributes.memberOrder, blocked.sourceRow.steps[0].chordMembers);
    const broken = engine.run({ exercise: { type: "chord-broken", root: "B#", quality: "major" } }).presentation.rows[0]; assert.equal(broken.graph.nodesOfType("chord").length, 0); assert.ok(broken.graph.nodesOfType("note").every(node => node instanceof NoteNode)); assert.equal(String(broken.graph.nodesOfType("note")[0].pitch), "B#4");
    const arpeggio = engine.run({ exercise: { type: "arpeggio-triad", root: "Db", quality: "major", direction: "ascending-descending" } }).presentation.rows[0]; assert.deepEqual(arpeggio.graph.nodesOfType("note").map(node => String(node.pitch)), arpeggio.sourceRow.writtenPitches);
    const next = arpeggio.graph.edges.filter(edge => String(edge.type) === "next"); assert.equal(next.length, arpeggio.notationRow.eventCount - 1);
});

test("all-key rows, independent graphs, sections, measures, and systems preserve source order", async () => {
    const { engine, kernel } = await runtime(); const all = engine.run({ exercise: { type: "scale", allKeys: true }, notation: { measuresPerSystem: 1 } });
    assert.deepEqual(all.presentation.rows.map(row => String(row.root)), ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]); assert.equal(new Set(all.presentation.rows.map(row => row.graph)).size, 12);
    for (const row of all.presentation.rows) { assert.deepEqual(row.systems.flatMap(system => system.measureIds), row.notationRow.systems.flatMap(system => system.measureIds)); assert.ok(row.systems.every(system => system instanceof ExercisePresentationSystem)); }
    const source = kernel.services.resolve("exercise.engine").generate({ type: "scale", allKeys: true }); const sections = [new ExerciseSection({ id: "first", title: "First", sequence: 1, rows: source.rows.slice(0, 5) }), new ExerciseSection({ id: "second", title: "Second", sequence: 2, rows: source.rows.slice(5) })]; const model = new ExerciseModel({ id: "two-sections", request: source.request, sections });
    const result = engine.run({ model }); assert.deepEqual(result.presentation.sections.map(section => section.title), ["First", "Second"]); assert.deepEqual(result.presentation.rows.map(row => row.sourceRow.id), source.rows.map(row => row.id)); assert.ok(result.presentation.sections.every(section => section instanceof ExercisePresentationSection));
});

test("requests reject unknown, conflicting, malformed, and unbounded renderer options", async () => {
    const { engine } = await runtime();
    for (const input of [{}, { exercise: {}, model: null }, { exercise: {}, unknown: true }, { exercise: {}, notation: { extra: true } }, { exercise: {}, notation: { strategyId: "x" } }, { exercise: {}, notation: { keySignature: "C" } }, { exercise: {}, rendering: { strategyId: "x" } }, { exercise: {}, rendering: { format: "" } }, { exercise: {}, rendering: { options: { onclick: "x" } } }]) assert.throws(() => engine.run(input), ValidationError);
    assert.throws(() => engine.run({ exercise: {}, rendering: { format: "musicxml" } }), error => error instanceof ExerciseApplicationWorkflowError && error.stage === "rendering");
});

test("canonical renderer options participate in deterministic request and presentation identity", async () => {
    const { engine } = await runtime();
    const request = options => new ExerciseApplicationRequest({ exercise: {}, rendering: { options } });
    const width800 = request({ width: 800 }), width900 = request({ width: 900 }), firstTitle = request({ title: "First" }), secondTitle = request({ title: "Second" }), firstMetadata = request({ metadata: { level: 1 } }), secondMetadata = request({ metadata: { level: 2 } });
    assert.notEqual(width800.identity, width900.identity); assert.notEqual(firstTitle.identity, secondTitle.identity); assert.notEqual(firstMetadata.identity, secondMetadata.identity);
    const ordered = request({ width: "800", metadata: { alpha: 1, nested: { beta: 2, gamma: [3, 4] } } }); const reordered = request({ metadata: { nested: { gamma: [3, 4], beta: 2 }, alpha: 1 }, width: 800 });
    assert.equal(ordered.identity, reordered.identity); assert.deepEqual(ordered, reordered); assert.ok(Object.isFrozen(ordered.rendering.options) && Object.isFrozen(ordered.rendering.options.metadata) && Object.isFrozen(ordered.rendering.options.metadata.nested.gamma));
    const first = engine.run(ordered), repeated = engine.run(reordered); assert.deepEqual(first, repeated); assert.equal(first.presentation.id, repeated.presentation.id);
    assert.notEqual(engine.run(width800).presentation.id, engine.run(width900).presentation.id); assert.notEqual(engine.run(firstTitle).presentation.id, engine.run(secondTitle).presentation.id); assert.notEqual(engine.run(firstMetadata).presentation.id, engine.run(secondMetadata).presentation.id);
});

test("canonical renderer metadata rejects unsupported and cyclic values without mutating input", () => {
    const cyclic = {}; cyclic.self = cyclic;
    const unsupported = [{ value: undefined }, { value() {} }, { value: Symbol("x") }, { value: NaN }, { value: Infinity }, { value: 1n }, { value: new Date() }, { value: [undefined] }, cyclic];
    for (const metadata of unsupported) assert.throws(() => new ExerciseApplicationRequest({ exercise: {}, rendering: { options: { metadata } } }), /deterministically serializable/);
    const metadata = { nested: { values: [1, 2] } }, before = JSON.stringify(metadata); new ExerciseApplicationRequest({ exercise: {}, rendering: { options: { metadata } } }); assert.equal(JSON.stringify(metadata), before); assert.equal(Object.isFrozen(metadata), false);
});

test("implicit and explicit renderer selection report the actual normalized strategy", async () => {
    const { kernel } = await runtime();
    class Alternate extends RendererStrategy { constructor() { super({ id: "alternate", pluginId: "test.exercise.renderer", format: "svg" }); } supports() { return true; } render(score) { return `<svg data-score="${score.score.id}"></svg>`; } }
    const strategy = new Alternate(); kernel.services.resolve("rendering.strategyRegistry").register(strategy.pluginId, strategy);
    const implicit = kernel.services.resolve("exercise.application.engine").run({ exercise: {} }); assert.equal(implicit.presentation.rows[0].rendererPluginId, "core.rendering.svg");
    const explicit = kernel.services.resolve("exercise.application.engine").run({ exercise: {}, rendering: { format: "SVG", pluginId: "test.exercise.renderer", strategyId: "alternate" } }); assert.equal(explicit.presentation.rows[0].rendererPluginId, "test.exercise.renderer"); assert.equal(explicit.presentation.rows[0].rendererStrategyId, "alternate"); assert.equal(explicit.presentation.rows[0].format, "svg"); assert.equal(explicit.metadata.rendering.pluginId, "test.exercise.renderer");
});

test("repeated equivalent runs are equal and never mutate notation documents or graphs", async () => {
    const { engine } = await runtime(); const request = new ExerciseApplicationRequest({ exercise: { type: "scale", root: "F#" } }); const first = engine.run(request); const notationBefore = JSON.stringify(first.notationDocument), graphsBefore = first.presentation.rows.map(row => JSON.stringify(row.graph)); const second = engine.run(request);
    assert.deepEqual(first, second); assert.equal(first.presentation.id, second.presentation.id); assert.equal(JSON.stringify(first.notationDocument), notationBefore); assert.deepEqual(first.presentation.rows.map(row => JSON.stringify(row.graph)), graphsBefore);
    const reversed = new ScoreGraph({ nodes: [...first.presentation.rows[0].graph.nodes].reverse(), edges: [...first.presentation.rows[0].graph.edges].reverse() }); const renderer = engine.renderingEngine; assert.equal(renderer.render(reversed, { format: "svg" }), renderer.render(first.presentation.rows[0].graph, { format: "svg" }));
});

test("generation, notation, and row rendering failures retain cause and release no partial result", async () => {
    const { kernel } = await runtime(); const services = { exerciseEngine: kernel.services.resolve("exercise.engine"), notationEngine: kernel.services.resolve("exercise.notation.engine"), renderingEngine: kernel.services.resolve("rendering.engine") };
    const generationCause = new Error("generation broke"); assert.throws(() => new ExerciseApplicationEngine({ ...services, exerciseEngine: { generate() { throw generationCause; } } }).run({ exercise: {} }), error => error.stage === "generation" && error.cause === generationCause);
    const notationCause = new Error("notation broke"); assert.throws(() => new ExerciseApplicationEngine({ ...services, notationEngine: { notate() { throw notationCause; } } }).run({ exercise: {} }), error => error.stage === "notation" && error.cause === notationCause);
    let renders = 0; const renderingCause = new Error("later row broke"); class LaterFailure extends RendererStrategy { constructor() { super({ id: "later", pluginId: "test.failure", format: "svg" }); } supports() { return true; } render() { renders += 1; if (renders === 2) throw renderingCause; return "<svg/>"; } }
    const strategy = new LaterFailure(), registry = kernel.services.resolve("rendering.strategyRegistry"); registry.register(strategy.pluginId, strategy); const renderingEngine = { registry, render(score, options) { return registry.select(score, options).render(score, options); } };
    assert.throws(() => new ExerciseApplicationEngine({ ...services, renderingEngine }).run({ exercise: { allKeys: true }, rendering: { pluginId: "test.failure", strategyId: "later" } }), error => error.stage === "rendering" && error.rowId !== null && error.cause === renderingCause); assert.equal(renders, 2);
});

test("module resolves active services per lifecycle and preserves explicit caller-owned services", async () => {
    const base = await runtime(); const kernel = new Kernel(); const ids = ["exercise.engine", "exercise.notation.engine", "rendering.engine"]; for (const id of ids) kernel.services.register(id, base.kernel.services.resolve(id)); const module = new ExerciseApplicationModule(); module.configure(kernel.context); const first = module.engine, firstPlugin = module.plugin; assert.strictEqual(module.configure(kernel.context), module); module.dispose(); assert.equal(module.engine, null); assert.equal(module.plugin, null);
    const replacement = { generate: base.kernel.services.resolve("exercise.engine").generate.bind(base.kernel.services.resolve("exercise.engine")) }; kernel.services.register("exercise.engine", replacement, { replace: true }); module.configure(kernel.context); assert.notStrictEqual(module.engine, first); assert.notStrictEqual(module.plugin, firstPlugin); assert.strictEqual(module.plugin.workflows[0], module.engine); assert.strictEqual(module.engine.exerciseEngine, replacement); module.dispose();
});

test("module registration is transactional across service, plugin, and workflow discovery", async () => {
    const source = await runtime(); const exerciseEngine = source.kernel.services.resolve("exercise.engine"), notationEngine = source.kernel.services.resolve("exercise.notation.engine"), renderingEngine = source.kernel.services.resolve("rendering.engine");
    const setup = () => { const kernel = new Kernel(); kernel.services.register("exercise.engine", exerciseEngine); kernel.services.register("exercise.notation.engine", notationEngine); kernel.services.register("rendering.engine", renderingEngine); return kernel; };
    const points = [["container", (k, m, value) => k.services.register("exercise.application.engine", value), k => k.services.resolve("exercise.application.engine", { optional: true })], ["service", (k, m, value) => k.registries.services.register(ExerciseApplication.serviceDescriptor, { value }), k => k.registries.services.resolve("exercise.application.engine")], ["plugin", (k, m, value) => k.registries.plugins.register(ExerciseApplication.pluginDescriptor, { value }), k => k.registries.plugins.resolve("core.exercise.application")], ["exercise", (k, m, value) => k.registries.exercises.register(ExerciseApplication.workflowDescriptor, { value }), k => k.registries.exercises.resolve("exercise.application")]];
    for (const [name, seed, read] of points) { const kernel = setup(), module = new ExerciseApplicationModule(), existing = { name }; seed(kernel, module, existing); assert.throws(() => module.configure(kernel.context)); assert.strictEqual(read(kernel), existing); assert.equal(kernel.services.resolve("exercise.application.engine", { optional: true }), name === "container" ? existing : null); }
    for (const registryName of ["services", "plugins", "exercises"]) { const kernel = setup(), module = new ExerciseApplicationModule(); kernel.registries[registryName].subscribe(event => { if (event.type === "registered") throw new Error("listener"); }); assert.throws(() => module.configure(kernel.context), /listener/); assert.equal(kernel.services.has("exercise.application.engine"), false); }
});

async function sameObjectCollision(point) {
    const source = await runtime(); const injected = new ExerciseApplicationEngine({ exerciseEngine: source.kernel.services.resolve("exercise.engine"), notationEngine: source.kernel.services.resolve("exercise.notation.engine"), renderingEngine: source.kernel.services.resolve("rendering.engine") }); const module = new ExerciseApplicationModule({ engine: injected }); const kernel = new Kernel(), unrelated = { point }; kernel.services.register("unrelated", unrelated);
    const targets = { container: [() => kernel.services.register("exercise.application.engine", module.engine), () => kernel.services.resolve("exercise.application.engine")], service: [() => kernel.registries.services.register(ExerciseApplication.serviceDescriptor, { value: module.engine }), () => kernel.registries.services.resolve("exercise.application.engine")], plugin: [() => kernel.registries.plugins.register(ExerciseApplication.pluginDescriptor, { value: module.plugin }), () => kernel.registries.plugins.resolve("core.exercise.application")], exercise: [() => kernel.registries.exercises.register(ExerciseApplication.workflowDescriptor, { value: module.engine }), () => kernel.registries.exercises.resolve("exercise.application")] };
    const [seed, read] = targets[point]; seed(); const intended = read(); assert.throws(() => module.configure(kernel.context)); assert.strictEqual(read(), intended); assert.strictEqual(kernel.services.resolve("unrelated"), unrelated);
    assert.equal(kernel.services.resolve("exercise.application.engine", { optional: true }), point === "container" ? intended : null); assert.equal(kernel.registries.services.has("exercise.application.engine"), point === "service"); assert.equal(kernel.registries.plugins.has("core.exercise.application"), point === "plugin"); assert.equal(kernel.registries.exercises.has("exercise.application"), point === "exercise");
}

test("same-object service-container collision is preserved transactionally", () => sameObjectCollision("container"));
test("same-object service-descriptor collision is preserved transactionally", () => sameObjectCollision("service"));
test("same-object plugin collision uses and preserves the module's stable plugin", () => sameObjectCollision("plugin"));
test("same-object workflow collision is preserved transactionally", () => sameObjectCollision("exercise"));

test("module disposal preserves replacements, unrelated registrations, and reusable lifecycle", async () => {
    const source = await runtime(); const kernel = new Kernel(); for (const id of ["exercise.engine", "exercise.notation.engine", "rendering.engine"]) kernel.services.register(id, source.kernel.services.resolve(id)); const unrelated = { unrelated: true }; kernel.services.register("unrelated", unrelated); const module = new ExerciseApplicationModule(); module.configure(kernel.context); const first = module.engine; module.dispose(); module.dispose(); assert.strictEqual(kernel.services.resolve("unrelated"), unrelated); module.configure(kernel.context); assert.notStrictEqual(module.engine, first); const replacement = { replacement: true }; kernel.services.register("exercise.application.engine", replacement, { replace: true }); module.dispose(); assert.strictEqual(kernel.services.resolve("exercise.application.engine"), replacement);
    kernel.services.unregister("exercise.application.engine"); const injected = new ExerciseApplicationEngine({ exerciseEngine: source.kernel.services.resolve("exercise.engine"), notationEngine: source.kernel.services.resolve("exercise.notation.engine"), renderingEngine: source.kernel.services.resolve("rendering.engine") }); const owned = new ExerciseApplicationModule({ engine: injected }), plugin = owned.plugin; assert.strictEqual(plugin.workflows[0], injected); owned.configure(kernel.context); owned.dispose(); assert.strictEqual(owned.engine, injected); assert.strictEqual(owned.plugin, plugin); owned.configure(kernel.context); assert.strictEqual(owned.plugin, plugin); owned.dispose();
    const replacements = [["container", (k, value) => k.services.register("exercise.application.engine", value, { replace: true }), k => k.services.resolve("exercise.application.engine")], ["service", (k, value) => k.registries.services.register(ExerciseApplication.serviceDescriptor, { value, replace: true }), k => k.registries.services.resolve("exercise.application.engine")], ["plugin", (k, value) => k.registries.plugins.register(ExerciseApplication.pluginDescriptor, { value, replace: true }), k => k.registries.plugins.resolve("core.exercise.application")], ["exercise", (k, value) => k.registries.exercises.register(ExerciseApplication.workflowDescriptor, { value, replace: true }), k => k.registries.exercises.resolve("exercise.application")]];
    for (const [name, replace, read] of replacements) { const k = new Kernel(), m = new ExerciseApplicationModule({ engine: injected }), value = { name }; m.configure(k.context); replace(k, value); m.dispose(); assert.strictEqual(read(k), value); }
});

test("public namespace, descriptors, legacy Application, and consumers remain independent", async () => {
    assert.ok(Object.isFrozen(ExerciseApplication)); assert.equal(String(ExerciseApplication.descriptor.version), "8.2.0"); assert.notStrictEqual(ExerciseApplication, Exercise); assert.ok(ExerciseApplication.ExercisePresentationDocument); assert.equal(ExerciseApplication.descriptor.metadata.tags.includes("headless"), true);
    const { kernel, engine } = await runtime(); const row = engine.run({ exercise: {} }).presentation.rows[0]; assert.doesNotThrow(() => kernel.services.resolve("rendering.engine").render(row.graph));
    assert.equal(kernel.registries.packages.has("core.exercise-application"), true); assert.strictEqual(kernel.registries.exercises.resolve("exercise.application"), engine); assert.equal(kernel.registries.plugins.has("core.exercise.application"), true);
    const playback = new PlaybackModule(); playback.configure(kernel.context); assert.doesNotThrow(() => playback.engine.plan(row.graph));
    const application = new MusicTheoryApplication(kernel.services); assert.doesNotThrow(() => application.run({ type: "scale", root: "C", pattern: "major" })); assert.ok(ApplicationModule);
});

test("Core presentation runs without accessing forbidden browser APIs on modern Node", () => {
    const script = `
        for (const name of ["window", "document", "AudioContext", "MIDIInput"]) {
            if (Object.getOwnPropertyDescriptor(globalThis, name)) throw new Error("test requires an otherwise-absent browser global: " + name);
            Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error("forbidden browser API accessed: " + name); } });
        }
        const Core = await import("./src/core/index.js");
        if ("MusicTheoryWebApp" in Core) throw new Error("Core imported a Web implementation");
        const kernel = new Core.Kernel().use(new Core.TheoryModule()).use(new Core.NotationModule()).use(new Core.RenderingModule()).use(new Core.ExerciseModule()).use(new Core.ExerciseNotationModule()).use(new Core.ExerciseApplicationModule());
        await kernel.start();
        const result = kernel.services.resolve("exercise.application.engine").run({ exercise: { type: "scale", root: "Cb" } });
        if (String(result.presentation.rows[0].graph.nodesOfType("note")[0].pitch) !== "Cb4") throw new Error("headless presentation mismatch");
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr || child.stdout);
});
