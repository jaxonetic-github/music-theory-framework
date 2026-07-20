import test from "node:test";
import assert from "node:assert/strict";

import {
    CANONICAL_EXERCISE_ROOTS, ChordGenerator, Exercise, ExerciseDescriptor, ExerciseDirection, ExerciseEngine,
    ExerciseModel, ExerciseModule, ExerciseRegistry, ExerciseRequest, ExerciseRow, ExerciseSection, ExerciseStep,
    ExerciseStrategy, ExerciseStrategyRegistry, ExerciseType, Foundation, FoundationalExerciseStrategy,
    GeneratorDescriptor, Kernel, Note, PlaybackPlan, ReferenceKind, Registries, ScaleCatalog, ScaleGenerator,
    ValidationError, defaultScalePatterns
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

test("ExerciseModule registers transactionally, remains isolated, reusable, and preserves replacements", () => {
    const kernel = new Kernel();
    const module = new ExerciseModule();
    module.configure(kernel.context);
    assert.strictEqual(kernel.services.resolve("exercise.engine"), module.engine);
    assert.strictEqual(kernel.registries.exercises.resolve("exercise.foundational"), module.foundationalStrategy);
    for (const name of ["generators", "renderers", "exporters", "playbacks"]) assert.equal(kernel.registries[name].size, 0);
    assert.ok(module.engine.generate({ type: "scale" }) instanceof ExerciseModel);
    const replacement = new FoundationalExerciseStrategy();
    const replacementRecord = kernel.registries.exercises.register(Exercise.strategyDescriptors.foundational, { value: replacement, replace: true });
    module.dispose(); module.dispose();
    assert.strictEqual(kernel.registries.exercises.getRecord("exercise.foundational"), replacementRecord);
    const reusableKernel = new Kernel(); const reusable = new ExerciseModule();
    reusable.configure(reusableKernel.context); reusable.dispose(); reusable.configure(reusableKernel.context);
    assert.ok(reusable.engine.generate({ type: "scale" }) instanceof ExerciseModel);
});

test("ExerciseModule preserves collisions, same objects, and rolls back listener failures", () => {
    for (const collision of ["service", "service-descriptor", "plugin", "exercise"]) {
        const kernel = new Kernel(); const module = new ExerciseModule(); const existing = { collision };
        if (collision === "service") kernel.services.register("exercise.engine", existing);
        if (collision === "service-descriptor") kernel.registries.services.register(Exercise.serviceDescriptors.engine, { value: existing });
        if (collision === "plugin") kernel.registries.plugins.register(Exercise.pluginDescriptor, { value: existing });
        if (collision === "exercise") kernel.registries.exercises.register(Exercise.strategyDescriptors.foundational, { value: existing });
        assert.throws(() => module.configure(kernel.context));
        const retained = collision === "service" ? kernel.services.resolve("exercise.engine")
            : collision === "service-descriptor" ? kernel.registries.services.resolve("exercise.engine")
            : collision === "plugin" ? kernel.registries.plugins.resolve("core.exercise.foundational")
            : kernel.registries.exercises.resolve("exercise.foundational");
        assert.strictEqual(retained, existing);
    }
    const sameKernel = new Kernel(); const same = new ExerciseModule();
    sameKernel.services.register("exercise.engine", same.engine);
    assert.throws(() => same.configure(sameKernel.context));
    assert.strictEqual(sameKernel.services.resolve("exercise.engine"), same.engine);

    const listenerKernel = new Kernel(); const listenerModule = new ExerciseModule();
    listenerKernel.registries.exercises.subscribe(() => { throw new Error("listener failed"); });
    assert.throws(() => listenerModule.configure(listenerKernel.context), /listener failed/);
    assert.equal(listenerKernel.services.has("exercise.engine"), false);
    assert.equal(listenerKernel.registries.exercises.has("exercise.foundational"), false);
});

test("Kernel disposal clears exercise discovery and public namespaces expose frozen v8 contracts", async () => {
    const kernel = new Kernel(); const module = new ExerciseModule(); kernel.use(module); await kernel.start();
    assert.equal(kernel.registries.exercises.size, 1);
    await kernel.dispose();
    assert.equal(kernel.registries.exercises.size, 0);
    assert.strictEqual(Foundation.ExerciseDescriptor, ExerciseDescriptor);
    assert.strictEqual(Registries.ExerciseRegistry, ExerciseRegistry);
    assert.strictEqual(Exercise.ExerciseModel, ExerciseModel);
    assert.equal(Object.isFrozen(Exercise), true);
    assert.equal(String(Exercise.descriptor.version), "8.0.0");
});
