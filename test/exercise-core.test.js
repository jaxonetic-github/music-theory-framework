import test from "node:test";
import assert from "node:assert/strict";

import {
    CANONICAL_EXERCISE_ROOTS, ChordGenerator, Exercise, ExerciseDescriptor, ExerciseDirection, ExerciseEngine,
    ExerciseModel, ExerciseModule, ExerciseRegistry, ExerciseRequest, ExerciseRow, ExerciseSection, ExerciseStep,
    ExerciseStrategy, ExerciseStrategyRegistry, ExerciseType, Foundation, FoundationalExerciseStrategy,
    GeneratorDescriptor, Kernel, Note, PlaybackPlan, ReferenceKind, Registries, ScaleCatalog, ScaleGenerator,
    ScalePattern, TheoryModule, ValidationError, defaultScalePatterns
} from "../src/core/index.js";

function engine(options = {}) {
    const registry = new ExerciseStrategyRegistry();
    registry.register("core.exercise.foundational", new FoundationalExerciseStrategy(options));
    return new ExerciseEngine(registry);
}

function generate(values = {}) { return engine().generate(values); }

test("ExerciseRequest validates families, roots, selection, directions, octaves, and unknown options", () => {
    const request = new ExerciseRequest({ type: "scale", root: "Cb", pattern: "melodic-minor", direction: "ascending-descending", octaves: 2, startingOctave: 3, pluginId: "p", strategyId: "s" });
    assert.equal(String(request.type), "scale");
    assert.equal(String(request.roots[0]), "Cb");
    assert.equal(String(request.direction), "ascending-descending");
    assert.equal(request.identity, "exercise:scale:c-flat:melodic-minor:ascending-descending:2oct:from3");
    for (const values of [{ unknown: true }, { type: "x" }, { direction: "sideways" }, { octaves: 3 }, { startingOctave: 1.5 }, { strategyId: "x" }, { root: "C", roots: ["D"] }, { allKeys: true, root: "C" }, { type: "scale", quality: "major" }, { type: "chord-blocked", pattern: "major" }]) {
        assert.throws(() => new ExerciseRequest(values), ValidationError);
    }
    assert.ok(ExerciseType.from("scale") instanceof ExerciseType);
    assert.ok(ExerciseDirection.from("descending") instanceof ExerciseDirection);
});

test("canonical and explicit roots preserve exact order and reject enharmonic duplicates", () => {
    const all = new ExerciseRequest({ type: "scale", allKeys: true });
    assert.deepEqual(all.roots.map(String), CANONICAL_EXERCISE_ROOTS);
    assert.equal(new Set(all.roots.map(root => root.semitones)).size, 12);
    const explicit = new ExerciseRequest({ type: "scale", roots: ["B#", "Cb", "F#"] });
    assert.deepEqual(explicit.roots.map(String), ["B#", "Cb", "F#"]);
    assert.throws(() => new ExerciseRequest({ roots: ["C", "B#"] }), /enharmonic duplicate/);
});

test("scale rows support exact directions, turnaround, and actual two-octave expansion", () => {
    const ascending = generate({ type: "scale", root: "C" }).rows[0];
    assert.deepEqual(ascending.writtenPitches, ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
    const descending = generate({ type: "scale", root: "C", direction: "descending" }).rows[0];
    assert.deepEqual(descending.writtenPitches, [...ascending.writtenPitches].reverse());
    const both = generate({ type: "scale", root: "C", direction: "ascending-descending" }).rows[0];
    assert.equal(both.writtenPitches.length, 15);
    assert.deepEqual(both.writtenPitches.slice(6, 10), ["B4", "C5", "B4", "A4"]);
    const two = generate({ type: "scale", root: "C", octaves: 2 }).rows[0];
    assert.equal(two.writtenPitches.length, 15);
    assert.equal(two.writtenPitches.at(-1), "C6");
});

test("melodic minor generates deterministically in every canonical key", () => {
    const first = generate({ type: "scale", allKeys: true, pattern: "melodic-minor" });
    const second = generate({ type: "scale", allKeys: true, pattern: "melodic-minor" });
    assert.equal(first.rows.length, 12);
    assert.deepEqual(first, second);
    assert.deepEqual(first.rows.map(row => String(row.root)), CANONICAL_EXERCISE_ROOTS);
    const reversedCatalog = new ScaleCatalog([...defaultScalePatterns].reverse());
    const reversed = engine({ scaleGenerator: new ScaleGenerator(reversedCatalog) }).generate({ type: "scale", allKeys: true, pattern: "melodic-minor" });
    assert.deepEqual(reversed, first);
    assert.throws(() => generate({ type: "scale", pattern: "missing" }), /not found/);
});

test("Cb and B# retain diatonic spelling, MIDI values, and altered octave crossings", () => {
    const cb = generate({ type: "scale", root: "Cb" }).rows[0];
    assert.deepEqual(cb.writtenPitches, ["Cb4", "Db4", "Eb4", "Fb4", "Gb4", "Ab4", "Bb4", "Cb5"]);
    assert.deepEqual(cb.steps.map(step => step.notes[0].midi), [59, 61, 63, 64, 66, 68, 70, 71]);
    const bs = generate({ type: "scale", root: "B#" }).rows[0];
    assert.equal(bs.writtenPitches[0], "B#4");
    assert.equal(bs.writtenPitches[1], "C##5");
    assert.equal(bs.steps[0].notes[0].midi, 72);
    assert.equal(bs.writtenPitches.at(-1), "B#5");
    assert.throws(() => generate({ type: "scale", root: "B#", startingOctave: 9 }), /MIDI range/);
});

test("scale thirds use every starting degree, wrap endpoints, and preserve direction", () => {
    const row = generate({ type: "scale-thirds", root: "C" }).rows[0];
    assert.equal(row.steps.length, 7);
    assert.deepEqual(row.steps[0].writtenPitches, ["C4", "E4"]);
    assert.deepEqual(row.steps.at(-1).writtenPitches, ["B4", "D5"]);
    assert.equal(row.steps.at(-1).metadata.endpointWrap, true);
    assert.equal(row.steps.every(step => !step.simultaneous), true);
    const descending = generate({ type: "scale-thirds", root: "C", direction: "descending" }).rows[0];
    assert.deepEqual(descending.steps[0].writtenPitches, ["D5", "B4"]);
    const both = generate({ type: "scale-thirds", root: "C", direction: "ascending-descending" }).rows[0];
    assert.equal(both.steps.length, 13);
    assert.equal(generate({ type: "scale-thirds", root: "F#", octaves: 2 }).rows[0].steps.length, 14);
});

test("triad and seventh arpeggios preserve member roles, directions, and registers", () => {
    const triad = generate({ type: "arpeggio-triad", root: "Eb", quality: "minor" }).rows[0];
    assert.deepEqual(triad.writtenPitches, ["Eb4", "Gb4", "Bb4", "Eb5"]);
    assert.deepEqual(triad.steps.map(step => step.chordMembers[0]), [1, 3, 5, 1]);
    assert.deepEqual(generate({ type: "arpeggio-triad", root: "Eb", quality: "minor", direction: "descending" }).rows[0].writtenPitches, ["Eb5", "Bb4", "Gb4", "Eb4"]);
    assert.equal(generate({ type: "arpeggio-triad", root: "C", octaves: 2 }).rows[0].writtenPitches.at(-1), "C6");
    const seventh = generate({ type: "arpeggio-seventh", root: "B#", quality: "major-7", direction: "ascending-descending" }).rows[0];
    assert.deepEqual(seventh.steps.slice(0, 5).map(step => step.chordMembers[0]), [1, 3, 5, 7, 1]);
    assert.equal(seventh.steps.length, 9);
    assert.throws(() => generate({ type: "arpeggio-triad", quality: "dominant-7" }), /incompatible/);
    assert.throws(() => generate({ type: "arpeggio-triad", quality: "suspended-4" }), /1–3–5/);
    assert.throws(() => generate({ type: "arpeggio-seventh", quality: "major" }), /incompatible/);
});

test("blocked and broken chords distinguish simultaneous and sequential semantic material", () => {
    const blocked = generate({ type: "chord-blocked", root: "F#", quality: "major" }).rows[0];
    assert.equal(blocked.steps.length, 1);
    assert.equal(blocked.steps[0].simultaneous, true);
    assert.deepEqual(blocked.steps[0].writtenPitches, ["F#4", "A#4", "C#5"]);
    assert.deepEqual(blocked.steps[0].chordMembers, [1, 3, 5]);
    const broken = generate({ type: "chord-broken", root: "F#", quality: "major" }).rows[0];
    assert.equal(broken.steps.every(step => step.notes.length === 1 && !step.simultaneous), true);
    assert.deepEqual(broken.writtenPitches, ["F#4", "A#4", "C#5", "F#5"]);
    assert.equal(blocked.steps[0].notes.some(note => note.constructor.name === "ChordNode"), false);
    assert.equal(blocked instanceof PlaybackPlan, false);
});

test("domain hierarchy rejects duplicate identities and remains deeply immutable", () => {
    const step = new ExerciseStep({ id: "s", sequence: 1, sourceId: "source", notes: [Note.from("C4")] });
    assert.throws(() => new ExerciseRow({ id: "r", title: "R", root: "C", direction: "ascending", octaves: 1, startingOctave: 4, type: "scale", steps: [step, step] }), /sequence|Duplicate/);
    const row = new ExerciseRow({ id: "r", title: "R", root: "C", direction: "ascending", octaves: 1, startingOctave: 4, type: "scale", steps: [step] });
    assert.throws(() => new ExerciseSection({ id: "x", title: "X", sequence: 1, rows: [row, row] }), /Duplicate/);
    const section = new ExerciseSection({ id: "x", title: "X", sequence: 1, rows: [row] });
    assert.throws(() => new ExerciseModel({ id: "m", request: { type: "scale" }, sections: [section, section] }), /sequence|Duplicate/);
    const model = generate({ type: "scale" });
    for (const value of [model.request, model, model.sections, model.sections[0], model.rows, model.rows[0], model.rows[0].steps, model.rows[0].steps[0], model.metadata]) assert.equal(Object.isFrozen(value), true);
    assert.throws(() => model.rows.push(row), TypeError);
});

test("generation never mutates source Theory values or results", () => {
    const scaleGenerator = new ScaleGenerator();
    const chordGenerator = new ChordGenerator();
    const scale = scaleGenerator.generate("Cb", "major");
    const chord = chordGenerator.generate("B#", "major-7");
    const scaleResult = scaleGenerator.generateResult("Cb", "major");
    const chordResult = chordGenerator.generateResult("B#", "major-7");
    const before = [JSON.stringify(scale), JSON.stringify(chord), JSON.stringify(scaleResult), JSON.stringify(chordResult)];
    engine({ scaleGenerator, chordGenerator }).generate({ type: "scale-thirds", root: "Cb" });
    engine({ scaleGenerator, chordGenerator }).generate({ type: "arpeggio-seventh", root: "B#", quality: "major-7" });
    assert.deepEqual([JSON.stringify(scale), JSON.stringify(chord), JSON.stringify(scaleResult), JSON.stringify(chordResult)], before);
});

test("strategy registry is plugin-isolated, replaceable, removable, and insertion-order independent", () => {
    class Marker extends ExerciseStrategy {
        constructor(pluginId, id = "shared") { super({ pluginId, id }); Object.freeze(this); }
        supports() { return true; }
        generate(request) { return generate({ type: "scale", root: String(request.roots[0]) }); }
    }
    const a = new Marker("z.plugin");
    const b = new Marker("a.plugin");
    const first = new ExerciseStrategyRegistry(); first.register(a.pluginId, a); first.register(b.pluginId, b);
    const second = new ExerciseStrategyRegistry(); second.register(b.pluginId, b); second.register(a.pluginId, a);
    const request = new ExerciseRequest({ type: "scale" });
    assert.strictEqual(first.select(request), b);
    assert.strictEqual(second.select(request), b);
    assert.strictEqual(first.select(new ExerciseRequest({ type: "scale", pluginId: "z.plugin" })), a);
    assert.throws(() => first.register("wrong", a), /belongs/);
    const replacement = new Marker("z.plugin");
    first.register("z.plugin", replacement, { replace: true });
    assert.strictEqual(first.get("z.plugin", "shared"), replacement);
    assert.equal(first.unregister("z.plugin", "shared"), true);
    assert.equal(first.unregisterPlugin("a.plugin"), 1);
});

test("ExerciseEngine validates selection and every output contract", () => {
    assert.throws(() => new ExerciseEngine().generate({ type: "scale" }), /No exercise strategy/);
    assert.throws(() => engine().generate(null), /request must be an object/);
    assert.throws(() => engine().generate({ type: "scale", pluginId: "missing", strategyId: "x" }), /not found/);
    class Broken extends ExerciseStrategy { constructor() { super({ id: "bad", pluginId: "bad" }); } supports() { return true; } generate() { return {}; } }
    const broken = new ExerciseStrategyRegistry(); broken.register("bad", new Broken());
    assert.throws(() => new ExerciseEngine(broken).generate({ type: "scale" }), /did not return/);
    class Mismatch extends ExerciseStrategy {
        constructor(mode) { super({ id: mode, pluginId: "mismatch" }); this.mode = mode; }
        supports() { return true; }
        generate(request) {
            const valid = generate({ type: "scale" });
            return new ExerciseModel({ id: this.mode === "identity" ? "wrong" : valid.id, request: this.mode === "request" ? valid.request : request, sections: valid.sections,
                metadata: this.mode === "metadata" ? { pluginId: "wrong", strategyId: this.id } : { pluginId: this.pluginId, strategyId: this.id } });
        }
    }
    for (const mode of ["request", "identity", "metadata"]) {
        const registry = new ExerciseStrategyRegistry(); registry.register("mismatch", new Mismatch(mode));
        assert.throws(() => new ExerciseEngine(registry).generate({ type: "scale" }), mode === "request" ? /different request/ : mode === "identity" ? /semantic identity/ : /metadata/);
    }
});

test("ExerciseDescriptor and ExerciseRegistry route first-class discovery only", () => {
    const descriptor = new ExerciseDescriptor({ id: "exercise.test", name: "Test", plugin: { id: "p", kind: "plugin" }, inputTypes: [{ id: "exercise.request", kind: "value" }], outputTypes: [{ id: "exercise.model", kind: "value" }] });
    assert.equal(descriptor.descriptorType, "exercise");
    assert.equal(String(new ReferenceKind("exercise")), "exercise");
    const registry = new ExerciseRegistry(); registry.register(descriptor);
    assert.strictEqual(registry.descriptor("exercise.test"), descriptor);
    assert.throws(() => registry.register(new GeneratorDescriptor({ id: "generator.test", name: "Generator" })), /accepts descriptor types/);
    const kernel = new Kernel();
    kernel.use({ id: "test.exercise-module", descriptor });
    assert.strictEqual(kernel.registries.exercises.descriptor("exercise.test"), descriptor);
    for (const name of ["generators", "renderers", "exporters", "playbacks"]) assert.equal(kernel.registries[name].has("exercise.test"), false);
});

test("ExerciseModule binds the exact active Theory generators and supports custom catalog material", async () => {
    const customPattern = new ScalePattern({ id: "custom-exercise-scale", name: "Custom Exercise Scale", intervals: [0, 1, 4, 5, 7, 8, 11] });
    const scaleCatalog = new ScaleCatalog([...defaultScalePatterns, customPattern]);
    const theory = new TheoryModule({ scaleCatalog });
    const kernel = new Kernel();
    const module = new ExerciseModule();
    kernel.use(theory); kernel.use(module); await kernel.start();
    assert.strictEqual(kernel.services.resolve("exercise.engine"), module.engine);
    assert.strictEqual(module.foundationalStrategy.scaleGenerator, kernel.services.resolve("theory.scaleGenerator"));
    assert.strictEqual(module.foundationalStrategy.chordGenerator, kernel.services.resolve("theory.chordGenerator"));
    assert.strictEqual(kernel.registries.exercises.resolve("exercise.foundational"), module.foundationalStrategy);
    const generated = module.engine.generate({ type: "scale", root: "C", pattern: "custom-exercise-scale" });
    assert.equal(generated.rows[0].pattern, "custom-exercise-scale");
    await kernel.dispose();
});

test("ExerciseModule observes replaced Theory generators and rebinds current services after reconfiguration", () => {
    const kernel = new Kernel();
    const initialScale = new ScaleGenerator(); const initialChord = new ChordGenerator();
    const replacementScale = new ScaleGenerator(); const replacementChord = new ChordGenerator();
    kernel.services.register("theory.scaleGenerator", initialScale);
    kernel.services.register("theory.chordGenerator", initialChord);
    kernel.services.register("theory.scaleGenerator", replacementScale, { replace: true });
    kernel.services.register("theory.chordGenerator", replacementChord, { replace: true });
    const module = new ExerciseModule(); module.configure(kernel.context);
    assert.strictEqual(module.foundationalStrategy.scaleGenerator, replacementScale);
    assert.strictEqual(module.foundationalStrategy.chordGenerator, replacementChord);
    const firstStrategy = module.foundationalStrategy;
    module.dispose();
    const nextScale = new ScaleGenerator(); const nextChord = new ChordGenerator();
    kernel.services.register("theory.scaleGenerator", nextScale, { replace: true });
    kernel.services.register("theory.chordGenerator", nextChord, { replace: true });
    module.configure(kernel.context);
    assert.notStrictEqual(module.foundationalStrategy, firstStrategy);
    assert.strictEqual(module.foundationalStrategy.scaleGenerator, nextScale);
    assert.strictEqual(module.foundationalStrategy.chordGenerator, nextChord);
    assert.ok(module.engine.generate({ type: "scale" }) instanceof ExerciseModel);
});

test("explicit strategies and generators retain caller ownership and standalone strategy construction", () => {
    const strategy = new FoundationalExerciseStrategy();
    const strategyKernel = new Kernel(); const strategyModule = new ExerciseModule({ foundationalStrategy: strategy });
    strategyModule.configure(strategyKernel.context);
    assert.strictEqual(strategyModule.foundationalStrategy, strategy);
    strategyModule.dispose();
    assert.strictEqual(strategyModule.foundationalStrategy, strategy);
    const scaleGenerator = new ScaleGenerator(); const chordGenerator = new ChordGenerator();
    const generatorKernel = new Kernel(); const generatorModule = new ExerciseModule({ scaleGenerator, chordGenerator });
    generatorModule.configure(generatorKernel.context);
    assert.strictEqual(generatorModule.foundationalStrategy.scaleGenerator, scaleGenerator);
    assert.strictEqual(generatorModule.foundationalStrategy.chordGenerator, chordGenerator);
    generatorModule.dispose();
    assert.ok(strategy.generate(new ExerciseRequest({ type: "scale" })) instanceof ExerciseModel);
});

function transactionModule() { return new ExerciseModule({ foundationalStrategy: new FoundationalExerciseStrategy() }); }
const registrationPoints = [
    { name: "engine container service", seed: (k, m, value) => k.services.register("exercise.engine", value), read: k => k.services.resolve("exercise.engine", { optional: true }), owned: m => m.engine },
    { name: "strategy container service", seed: (k, m, value) => k.services.register("exercise.strategyRegistry", value), read: k => k.services.resolve("exercise.strategyRegistry", { optional: true }), owned: m => m.strategyRegistry },
    { name: "engine service descriptor", registry: "services", id: "exercise.engine", descriptor: () => Exercise.serviceDescriptors.engine, seed: (k, m, value) => k.registries.services.register(Exercise.serviceDescriptors.engine, { value }), read: k => k.registries.services.resolve("exercise.engine"), owned: m => m.engine },
    { name: "strategy service descriptor", registry: "services", id: "exercise.strategy-registry", descriptor: () => Exercise.serviceDescriptors.strategies, seed: (k, m, value) => k.registries.services.register(Exercise.serviceDescriptors.strategies, { value }), read: k => k.registries.services.resolve("exercise.strategy-registry"), owned: m => m.strategyRegistry },
    { name: "default plugin", registry: "plugins", id: "core.exercise.foundational", descriptor: () => Exercise.pluginDescriptor, seed: (k, m, value) => k.registries.plugins.register(Exercise.pluginDescriptor, { value }), read: k => k.registries.plugins.resolve("core.exercise.foundational"), owned: m => m.plugin },
    { name: "foundational exercise descriptor", registry: "exercises", id: "exercise.foundational", descriptor: () => Exercise.strategyDescriptors.foundational, seed: (k, m, value) => k.registries.exercises.register(Exercise.strategyDescriptors.foundational, { value }), read: k => k.registries.exercises.resolve("exercise.foundational"), owned: m => m.foundationalStrategy }
];

function assertNoExerciseLeaks(kernel, retainedPoint = null) {
    for (const id of ["exercise.engine", "exercise.strategyRegistry"]) {
        if (retainedPoint?.id !== id || retainedPoint.registry) assert.equal(kernel.services.has(id), false);
    }
    for (const [registry, ids] of [["services", ["exercise.engine", "exercise.strategy-registry"]], ["plugins", ["core.exercise.foundational"]], ["exercises", ["exercise.foundational"]]]) {
        for (const id of ids) if (!(retainedPoint?.registry === registry && retainedPoint.id === id)) assert.equal(kernel.registries[registry].has(id), false);
    }
}

test("ExerciseModule preserves different- and same-object collisions with rollback at all six points", () => {
    for (const point of registrationPoints) for (const same of [false, true]) {
        const kernel = new Kernel(); const module = transactionModule();
        const existing = same ? point.owned(module) : Object.freeze({ point: point.name });
        point.seed(kernel, module, existing);
        assert.throws(() => module.configure(kernel.context), /already registered|Duplicate registration/);
        assert.strictEqual(point.read(kernel), existing, `${point.name} ${same ? "same" : "different"} collision`);
        assertNoExerciseLeaks(kernel, { registry: point.registry ?? null, id: point.id ?? (point.name.startsWith("engine") ? "exercise.engine" : "exercise.strategyRegistry") });
        assert.equal(module.strategyRegistry.strategies("core.exercise.foundational").length, 0);
    }
});

test("ExerciseModule cleans listener failures and rolls back all earlier registrations", () => {
    for (const point of registrationPoints.filter(value => value.registry)) {
        const kernel = new Kernel(); const module = transactionModule();
        kernel.registries[point.registry].subscribe(event => {
            if (String(event.record?.id) === point.id && event.type === "registered") throw new Error(`listener failed at ${point.name}`);
        });
        assert.throws(() => module.configure(kernel.context), /listener failed/);
        assertNoExerciseLeaks(kernel);
        assert.equal(module.strategyRegistry.strategies("core.exercise.foundational").length, 0);
    }
});

test("ExerciseModule disposal preserves replacements at all six external registration points", () => {
    for (const point of registrationPoints) {
        const kernel = new Kernel(); const module = transactionModule(); module.configure(kernel.context);
        const replacement = Object.freeze({ replacement: point.name });
        if (!point.registry) {
            const id = point.name.startsWith("engine") ? "exercise.engine" : "exercise.strategyRegistry";
            kernel.services.register(id, replacement, { replace: true });
        } else kernel.registries[point.registry].register(point.descriptor(), { value: replacement, replace: true });
        module.dispose();
        assert.strictEqual(point.read(kernel), replacement, point.name);
    }
});

test("missing Theory services fail transactionally without any Exercise registration leak", () => {
    for (const missing of ["both", "scale", "chord"]) {
        const kernel = new Kernel();
        if (missing !== "scale" && missing !== "both") kernel.services.register("theory.scaleGenerator", new ScaleGenerator());
        if (missing !== "chord" && missing !== "both") kernel.services.register("theory.chordGenerator", new ChordGenerator());
        const module = new ExerciseModule();
        assert.throws(() => module.configure(kernel.context), /requires active theory/);
        assertNoExerciseLeaks(kernel);
        assert.equal(module.strategyRegistry.strategies("core.exercise.foundational").length, 0);
        assert.strictEqual(module.foundationalStrategy, null);
    }
});

test("Kernel disposal clears exercise discovery and public namespaces expose frozen v8 contracts", async () => {
    const kernel = new Kernel(); const module = transactionModule(); kernel.use(module); await kernel.start();
    assert.equal(kernel.registries.exercises.size, 2);
    await kernel.dispose();
    assert.equal(kernel.registries.exercises.size, 0);
    assert.strictEqual(Foundation.ExerciseDescriptor, ExerciseDescriptor);
    assert.strictEqual(Registries.ExerciseRegistry, ExerciseRegistry);
    assert.strictEqual(Exercise.ExerciseModel, ExerciseModel);
    assert.equal(Object.isFrozen(Exercise), true);
    assert.equal(String(Exercise.descriptor.version), "8.4.0");
});
