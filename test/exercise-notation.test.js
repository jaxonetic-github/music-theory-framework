import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordNode, Duration, Exercise, ExerciseModel, ExerciseModule, ExerciseNotation, ExerciseNotationDocument,
    ExerciseNotationEngine, ExerciseNotationModule, ExerciseNotationRequest, ExerciseRowNotationStrategy,
    FoundationalExerciseStrategy, Kernel, KeySignature, MusicXmlExporter, NotationModule, NotationStrategy, NotationStrategyRegistry,
    NoteNode, ScoreGraph, ScorePlaybackPlanner, SvgScoreRenderer, TheoryModule, ValidationError
} from "../src/core/index.js";

async function fixture(exercise = {}) {
    const kernel = new Kernel(); kernel.use(new TheoryModule()).use(new NotationModule()).use(new ExerciseModule()); await kernel.start();
    const model = kernel.services.resolve("exercise.engine").generate(exercise); const module = new ExerciseNotationModule(); module.configure(kernel.context);
    return { kernel, model, module, document: module.engine.notate(model) };
}

test("request defaults and validation use exact immutable notation values", async () => {
    const { model } = await fixture(); const request = new ExerciseNotationRequest({ model });
    assert.equal(String(request.duration), "1/4"); assert.deepEqual(request.timeSignature, { beats: 4, beatUnit: 4 }); assert.equal(String(request.clef), "treble"); assert.equal(request.measuresPerSystem, 4); assert.equal(request.keySignaturePolicy, "none");
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.timeSignature) && Object.isFrozen(request.metadata));
    for (const value of [{ model, extra: true }, { model, duration: { numerator: 0, denominator: 4 } }, { model, duration: { numerator: Number.MAX_SAFE_INTEGER + 1, denominator: 4 } }, { model, clef: "alto" }, { model, timeSignature: { beats: 0, beatUnit: 4 } }, { model, timeSignature: { beats: 4, beatUnit: 4, extra: true } }, { model, measuresPerSystem: 0 }, { model, keySignaturePolicy: "guess" }, { model, keySignaturePolicy: "explicit" }]) assert.throws(() => new ExerciseNotationRequest(value), ValidationError);
});

test("scale rows become self-contained deterministic ScoreGraphs without mutating ExerciseModel", async () => {
    const { model, module } = await fixture({ type: "scale", root: "Cb" }); const before = JSON.stringify(model); const a = module.engine.notate(model), b = module.engine.notate(model);
    assert.ok(a instanceof ExerciseNotationDocument); assert.strictEqual(a.model, model); assert.strictEqual(a.rows[0].sourceRow, model.rows[0]); assert.ok(a.rows[0].graph instanceof ScoreGraph);
    assert.deepEqual(a, b); assert.equal(JSON.stringify(model), before); assert.ok(Object.isFrozen(a) && Object.isFrozen(a.sections) && Object.isFrozen(a.rows) && Object.isFrozen(a.rows[0].systems));
    assert.deepEqual(a.rows[0].graph.nodesOfType("note").map(node => String(node.pitch)), model.rows[0].writtenPitches);
});

test("melodic, blocked, broken, and scale-thirds steps preserve semantic shapes and source identities", async () => {
    const scale = await fixture({ type: "scale" }); assert.ok(scale.document.rows[0].graph.nodesOfType("note")[0] instanceof NoteNode);
    const blocked = await fixture({ type: "chord-blocked", quality: "major" }); const chord = blocked.document.rows[0].graph.nodesOfType("chord")[0];
    assert.ok(chord instanceof ChordNode); assert.deepEqual(chord.notes.map(String), blocked.model.rows[0].steps[0].notes.map(String)); assert.deepEqual(chord.metadata.attributes.memberOrder, blocked.model.rows[0].steps[0].chordMembers);
    const broken = await fixture({ type: "chord-broken", quality: "major" }); assert.equal(broken.document.rows[0].graph.nodesOfType("chord").length, 0); assert.equal(broken.document.rows[0].graph.nodesOfType("note").length, broken.model.rows[0].steps.length);
    const thirds = await fixture({ type: "scale-thirds" }); const notes = thirds.document.rows[0].graph.nodesOfType("note"); const step = thirds.model.rows[0].steps[0];
    assert.equal(notes[0].metadata.attributes.stepId, step.id); assert.equal(notes[1].metadata.attributes.stepId, step.id); assert.notEqual(String(notes[0].id), String(notes[1].id)); assert.deepEqual(notes.slice(0, 2).map(node => String(node.pitch)), step.notes.map(String));
});

test("exact rational durations group measures without splitting and mark incomplete finals", async () => {
    const { model, module } = await fixture({ type: "scale" });
    const quarter = module.engine.notate(model); assert.equal(quarter.rows[0].measureCount, 2); assert.equal(quarter.rows[0].finalMeasureComplete, true);
    const eighth = module.engine.notate(model, { duration: { numerator: 1, denominator: 8 } }); assert.equal(eighth.rows[0].measureCount, 1); assert.equal(eighth.rows[0].finalMeasureComplete, true);
    const half = module.engine.notate(model, { duration: { numerator: 1, denominator: 2 } }); assert.equal(half.rows[0].measureCount, 4);
    const dotted = module.engine.notate(model, { duration: { numerator: 3, denominator: 8 } }); assert.equal(dotted.rows[0].measureCount, 4); assert.equal(dotted.rows[0].finalMeasureComplete, false);
    const mixed = module.engine.notate(model, { duration: { numerator: 2, denominator: 8 }, timeSignature: { beats: 3, beatUnit: 4 } }); assert.equal(String(mixed.request.duration), "1/4"); assert.equal(mixed.rows[0].measureCount, 3); assert.equal(mixed.rows[0].finalMeasureComplete, false);
    assert.throws(() => module.engine.notate(model, { duration: { numerator: 5, denominator: 4 } }), /longer than one measure/);
});

test("measure numbering, next precedence, and semantic system grouping are stable", async () => {
    const { model, module } = await fixture({ type: "scale", octaves: 2 }); const doc = module.engine.notate(model, { measuresPerSystem: 3 }); const row = doc.rows[0];
    assert.deepEqual(row.graph.nodesOfType("measure").map(value => value.number), [1, 2, 3, 4]); assert.deepEqual(row.systems.map(value => value.measureIds.length), [3, 1]);
    assert.equal(new Set(row.systems.flatMap(value => value.measureIds)).size, row.measureCount);
    const events = row.graph.nodes.filter(node => ["note", "rest", "chord"].includes(String(node.type))).sort((left, right) => left.offset - right.offset);
    const next = row.graph.edges.filter(edge => String(edge.type) === "next");
    assert.equal(next.length, row.eventCount - 1);
    assert.deepEqual(next.map(edge => [String(edge.from), String(edge.to)]), events.slice(1).map((event, index) => [String(events[index].id), String(event.id)]));
    const successors = new Map(next.map(edge => [String(edge.from), String(edge.to)])); const visited = [];
    for (let id = String(events[0].id); id; id = successors.get(id)) { assert.equal(visited.includes(id), false); visited.push(id); }
    assert.deepEqual(visited, events.map(event => String(event.id)));
    const voices = row.graph.nodesOfType("voice"); assert.equal(voices.length, row.measureCount); assert.equal(new Set(voices.map(voice => String(voice.id))).size, row.measureCount);

    const reversed = new ScoreGraph({ nodes: [...row.graph.nodes].reverse(), edges: [...row.graph.edges].reverse() });
    const eventIds = events.map(event => String(event.id));
    const renderedOrder = graph => { const output = new SvgScoreRenderer().render(graph); return eventIds.slice().sort((left, right) => output.indexOf(`data-node-id="${left}"`) - output.indexOf(`data-node-id="${right}"`)); };
    assert.deepEqual(renderedOrder(reversed), renderedOrder(row.graph));
    assert.equal(new MusicXmlExporter().export(reversed).content, new MusicXmlExporter().export(row.graph).content);
    const playbackOrder = graph => new ScorePlaybackPlanner().plan(graph).events.map(event => event.sourceEventId);
    assert.deepEqual(playbackOrder(reversed), playbackOrder(row.graph));
});

test("all-key rows retain canonical root order and exact altered spelling", async () => {
    const { document } = await fixture({ type: "scale", allKeys: true }); assert.equal(document.rows.length, 12); assert.deepEqual(document.rows.map(row => String(row.root)), ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]);
    for (const root of ["Db", "F#"]) { const row = document.rows.find(value => String(value.root) === root); assert.equal(String(row.graph.nodesOfType("note")[0].pitch), `${root}4`); }
    for (const root of ["Cb", "B#"]) { const item = await fixture({ type: "scale", root }); assert.equal(String(item.document.rows[0].graph.nodesOfType("note")[0].pitch), `${root}4`); }
});

test("key-signature policies and treble/bass clefs are conservative and deterministic", async () => {
    const { model, module } = await fixture({ type: "scale", root: "F#" });
    const noneGraph = module.engine.notate(model).rows[0].graph; assert.equal(noneGraph.nodesOfType("measure")[0].keySignature, null); assert.match(new SvgScoreRenderer().render(noneGraph), /no key signature/); assert.doesNotMatch(new MusicXmlExporter().export(noneGraph).content, /<key>/);
    const explicit = module.engine.notate(model, { keySignaturePolicy: "explicit", keySignature: new KeySignature("Db"), clef: "bass" }); assert.equal(String(explicit.rows[0].graph.nodesOfType("measure")[0].keySignature), "Db major"); assert.equal(String(explicit.rows[0].graph.nodesOfType("part")[0].clef), "bass");
    assert.equal(String(module.engine.notate(model, { keySignaturePolicy: "exercise-root" }).rows[0].graph.nodesOfType("measure")[0].keySignature), "F# major");
    const cb = await fixture({ type: "scale", root: "Cb" }); assert.equal(String(cb.module.engine.notate(cb.model, { keySignaturePolicy: "exercise-root" }).rows[0].graph.nodesOfType("measure")[0].keySignature), "Cb major");
    const melodic = await fixture({ type: "scale", root: "A", pattern: "melodic-minor" }); assert.equal(String(melodic.module.engine.notate(melodic.model, { keySignaturePolicy: "exercise-root" }).rows[0].graph.nodesOfType("measure")[0].keySignature), "A minor");
    const bs = await fixture({ type: "scale", root: "B#" }); assert.throws(() => bs.module.engine.notate(bs.model, { keySignaturePolicy: "exercise-root" }), /Unsupported major key signature/);
});

test("shared notation selection is deterministic, explicit, isolated, and preserves existing workflows", async () => {
    const { kernel, model, module } = await fixture(); const active = kernel.services.resolve("notation.strategyRegistry"); assert.strictEqual(module.strategyRegistry, active);
    const a = new ExerciseRowNotationStrategy(); const other = new ExerciseRowNotationStrategy();
    const r1 = new NotationStrategyRegistry(), r2 = new NotationStrategyRegistry(); r1.register(a.pluginId, a); r1.register(other.pluginId, other, { replace: true }); r2.register(other.pluginId, other); r2.register(a.pluginId, a, { replace: true });
    assert.equal(String(r1.select(model.rows[0]).id), String(r2.select(model.rows[0]).id));
    assert.throws(() => module.engine.notate(model, { pluginId: "core.notation.defaults", strategyId: "scale" }), /does not support/);
    const theoryResult = kernel.services.resolve("theory.scaleGenerator").generateResult("C", "major"); assert.ok(kernel.services.resolve("notation.engine").notate(theoryResult) instanceof ScoreGraph);
});

test("engine rejects missing support and invalid strategy output", async () => {
    const { model } = await fixture(); const empty = new NotationStrategyRegistry(); assert.throws(() => new ExerciseNotationEngine(empty).notate(model), /No notation strategy/);
    class Invalid extends NotationStrategy { constructor() { super({ id: "invalid", pluginId: "invalid.plugin", inputType: "exercise-row" }); } supports() { return true; } notate() { return {}; } }
    const registry = new NotationStrategyRegistry(); const invalid = new Invalid(); registry.register(invalid.pluginId, invalid); assert.throws(() => new ExerciseNotationEngine(registry).notate(model), /did not return a ScoreGraph/);
    const delegate = new ExerciseRowNotationStrategy();
    class Mismatched extends NotationStrategy { constructor() { super({ id: "mismatched", pluginId: "mismatch.plugin", inputType: "exercise-row" }); } supports() { return true; } notate(row, options) { return delegate.notate(row, { ...options, sectionId: "wrong-section" }); } }
    const mismatchRegistry = new NotationStrategyRegistry(), mismatch = new Mismatched(); mismatchRegistry.register(mismatch.pluginId, mismatch); assert.throws(() => new ExerciseNotationEngine(mismatchRegistry).notate(model), /mismatched source identity/);
});

test("ExerciseNotationModule binds active registries, rebinds replacements, and fails without leaks", async () => {
    const model = new FoundationalExerciseStrategy().generate(new Exercise.ExerciseRequest({ type: "scale" }));
    const kernel = new Kernel(); const module = new ExerciseNotationModule(); assert.throws(() => module.configure(kernel.context), /requires the active/); assert.equal(kernel.services.has("exercise.notation.engine"), false); assert.equal(kernel.registries.exercises.has("exercise.notation"), false);
    const first = new NotationStrategyRegistry(); kernel.services.register("notation.strategyRegistry", first); module.configure(kernel.context); assert.strictEqual(module.strategyRegistry, first); module.dispose();
    const second = new NotationStrategyRegistry(); kernel.services.register("notation.strategyRegistry", second, { replace: true }); module.configure(kernel.context); assert.strictEqual(module.strategyRegistry, second); assert.strictEqual(second.get("core.exercise.notation", "exercise-row"), module.strategy); assert.ok(module.engine.notate(model) instanceof ExerciseNotationDocument); module.dispose(); module.dispose();
});

test("ExerciseNotationModule registration is transactional and preserves collisions, listeners, and replacements", () => {
    const points = [
        ["container", (k, m, v) => k.services.register("exercise.notation.engine", v), (k) => k.services.resolve("exercise.notation.engine", { optional: true })],
        ["service", (k, m, v) => k.registries.services.register(ExerciseNotation.serviceDescriptor, { value: v }), k => k.registries.services.resolve("exercise.notation.engine")],
        ["plugin", (k, m, v) => k.registries.plugins.register(ExerciseNotation.pluginDescriptor, { value: v }), k => k.registries.plugins.resolve("core.exercise.notation")],
        ["exercise", (k, m, v) => k.registries.exercises.register(ExerciseNotation.exerciseDescriptor, { value: v }), k => k.registries.exercises.resolve("exercise.notation")]
    ];
    for (const [name, seed, read] of points) for (const same of [false, true]) {
        const k = new Kernel(), registry = new NotationStrategyRegistry(); k.services.register("notation.strategyRegistry", registry); const engine = new ExerciseNotationEngine(registry); const m = new ExerciseNotationModule({ strategyRegistry: registry, engine }); const owned = name === "container" || name === "service" ? engine : name === "plugin" ? m.plugin : m.strategy; const existing = same ? owned : { name }; seed(k, m, existing); assert.throws(() => m.configure(k.context)); assert.strictEqual(read(k), existing); assert.equal(registry.get("core.exercise.notation", "exercise-row"), null);
    }
    for (const registryName of ["services", "plugins", "exercises"]) { const k = new Kernel(), registry = new NotationStrategyRegistry(); k.services.register("notation.strategyRegistry", registry); const m = new ExerciseNotationModule(); k.registries[registryName].subscribe(event => { if (event.type === "registered") throw new Error("listener"); }); assert.throws(() => m.configure(k.context), /listener/); assert.equal(k.services.has("exercise.notation.engine"), false); assert.equal(registry.get("core.exercise.notation", "exercise-row"), null); }
    for (const [name,, read] of points) { const k = new Kernel(), registry = new NotationStrategyRegistry(); k.services.register("notation.strategyRegistry", registry); const engine = new ExerciseNotationEngine(registry); const m = new ExerciseNotationModule({ strategyRegistry: registry, engine }); m.configure(k.context); const replacement = { replacement: name }; if (name === "container") k.services.register("exercise.notation.engine", replacement, { replace: true }); else k.registries[name === "service" ? "services" : name === "plugin" ? "plugins" : "exercises"].register(name === "service" ? ExerciseNotation.serviceDescriptor : name === "plugin" ? ExerciseNotation.pluginDescriptor : ExerciseNotation.exerciseDescriptor, { value: replacement, replace: true }); m.dispose(); assert.strictEqual(read(k), replacement); }
    const sharedKernel = new Kernel(), sharedRegistry = new NotationStrategyRegistry(), sharedModule = new ExerciseNotationModule({ strategyRegistry: sharedRegistry }); sharedRegistry.register(sharedModule.strategy.pluginId, sharedModule.strategy); sharedModule.configure(sharedKernel.context); sharedModule.dispose(); assert.strictEqual(sharedRegistry.get(sharedModule.strategy.pluginId, sharedModule.strategy.id), sharedModule.strategy);
    const collisionKernel = new Kernel(), collisionRegistry = new NotationStrategyRegistry(), collisionModule = new ExerciseNotationModule({ strategyRegistry: collisionRegistry }), conflicting = new ExerciseRowNotationStrategy(); collisionRegistry.register(conflicting.pluginId, conflicting); assert.throws(() => collisionModule.configure(collisionKernel.context)); assert.strictEqual(collisionRegistry.get(conflicting.pluginId, conflicting.id), conflicting); assert.equal(collisionKernel.services.has("exercise.notation.engine"), false);
    const replacementKernel = new Kernel(), replacementRegistry = new NotationStrategyRegistry(), replacementModule = new ExerciseNotationModule({ strategyRegistry: replacementRegistry }); replacementModule.configure(replacementKernel.context); const replacementStrategy = new ExerciseRowNotationStrategy(); replacementRegistry.register(replacementStrategy.pluginId, replacementStrategy, { replace: true }); replacementModule.dispose(); assert.strictEqual(replacementRegistry.get(replacementStrategy.pluginId, replacementStrategy.id), replacementStrategy);
});

test("public namespace is frozen and discovery remains exercise-only", async () => {
    assert.ok(Object.isFrozen(ExerciseNotation)); const { kernel } = await fixture(); assert.equal(kernel.registries.exercises.has("exercise.notation"), true); assert.equal(kernel.registries.exercises.has("exercise.foundational"), true); for (const name of ["generators", "renderers", "exporters", "playbacks"]) assert.equal(kernel.registries[name].has("exercise.notation"), false);
    class Unrelated extends NotationStrategy { constructor() { super({ id: "unrelated", pluginId: "test.unrelated", inputType: "none" }); } }
    const lifecycle = new Kernel(); lifecycle.use(new TheoryModule()).use(new NotationModule()).use(new ExerciseModule()).use(new ExerciseNotationModule()); await lifecycle.start(); const active = lifecycle.services.resolve("notation.strategyRegistry"), unrelated = new Unrelated(); active.register(unrelated.pluginId, unrelated); await lifecycle.dispose(); assert.equal(lifecycle.registries.exercises.has("exercise.notation"), false); assert.strictEqual(active.get(unrelated.pluginId, unrelated.id), unrelated); assert.equal(active.get("core.exercise.notation", "exercise-row"), null);
});
