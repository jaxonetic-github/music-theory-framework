import test from "node:test";
import assert from "node:assert/strict";
import {
    AdvancedExerciseStrategy, APPROACH_PATTERNS, CANONICAL_EXERCISE_ROOTS, CHORD_TARGETS,
    ChordGenerator, ChordNode, ENCLOSURE_PATTERNS, Exercise, ExerciseApplicationModule,
    ExerciseModel, ExerciseModule, ExerciseNotationModule, ExerciseRequest, ExerciseRow, ExerciseSection, ExerciseStep,
    ExerciseStrategyRegistry, FoundationalExerciseStrategy, Kernel,
    NotationModule, NoteNode, ProgressionCatalog, ProgressionDefinition, RenderingModule,
    ScaleGenerator, TheoryModule, ValidationError, defaultProgressions
} from "../src/core/index.js";

async function fixture() {
    const kernel = new Kernel().use(new TheoryModule()).use(new NotationModule()).use(new RenderingModule())
        .use(new ExerciseModule()).use(new ExerciseNotationModule()).use(new ExerciseApplicationModule());
    await kernel.start();
    return { kernel, engine: kernel.services.resolve("exercise.engine"), application: kernel.services.resolve("exercise.application.engine") };
}

test("advanced request contracts validate family options without leaking contradictory state", () => {
    const approach = new ExerciseRequest({ type: "approach-note", root: "Cb", quality: "dominant-7", target: "seventh", approachPattern: "diatonic-above" });
    assert.equal(String(approach.roots[0]), "Cb"); assert.equal(String(approach.approachPattern), "diatonic-above"); assert.equal(String(approach.target), "seventh");
    const progression = new ExerciseRequest({ type: "chord-progression", root: "B#", progression: "ii-v-i-major" });
    assert.equal(progression.quality, null); assert.equal(progression.target, null); assert.equal(progression.pattern, null);
    for (const value of [
        { type: "scale", approachPattern: "chromatic-below" }, { type: "enclosure", approachPattern: "chromatic-below" },
        { type: "approach-note", enclosurePattern: "chromatic-above-below" }, { type: "chord-progression", quality: "major" },
        { type: "scale", progression: "ii-v-i-major" }, { type: "approach-note", direction: "descending" },
        { type: "enclosure", octaves: 2 }, { type: "approach-note", approachPattern: "unknown" }
    ]) assert.throws(() => new ExerciseRequest(value), ValidationError);
});

test("approach patterns generate sequential approach-target phrases with exact semantic identity", async () => {
    const { engine } = await fixture();
    for (const pattern of APPROACH_PATTERNS) {
        const row = engine.generate({ type: "approach-note", root: "C", quality: "major-7", target: "root", approachPattern: pattern }).rows[0];
        const step = row.steps[0]; assert.equal(step.simultaneous, false); assert.equal(step.notes.length, 2);
        assert.equal(step.notes[1].midi, 60); assert.equal(step.metadata.targetChordMember, 1); assert.equal(step.metadata.eventRoles[0].role, "approach");
        assert.equal(step.metadata.eventRoles[1].role, "target"); assert.equal(step.metadata.resolutionTarget, String(step.notes[1]));
    }
});

test("approach target selection supports every available chord member and rejects missing sevenths", async () => {
    const { engine } = await fixture();
    for (const [target, role] of [["root", 1], ["third", 3], ["fifth", 5], ["seventh", 7]]) {
        const row = engine.generate({ type: "approach-note", quality: "major-7", target }).rows[0];
        assert.deepEqual(row.steps.map(step => step.metadata.targetChordMember), [role]);
    }
    assert.deepEqual(engine.generate({ type: "approach-note", quality: "major-7", target: "all" }).rows[0].steps.map(step => step.metadata.targetChordMember), [1, 3, 5, 7]);
    assert.throws(() => engine.generate({ type: "approach-note", quality: "major", target: "seventh" }), /does not provide target seventh/);
});

test("approach spelling preserves Cb and B# targets with MIDI-correct octave crossings", async () => {
    const { engine } = await fixture();
    const cb = engine.generate({ type: "approach-note", root: "Cb", target: "root", approachPattern: "chromatic-below" }).rows[0].steps[0];
    assert.deepEqual(cb.notes.map(String), ["Cbb4", "Cb4"]); assert.deepEqual(cb.notes.map(note => note.midi), [58, 59]);
    const bs = engine.generate({ type: "approach-note", root: "B#", target: "root", approachPattern: "chromatic-above" }).rows[0].steps[0];
    assert.deepEqual(bs.notes.map(String), ["B##4", "B#4"]); assert.deepEqual(bs.notes.map(note => note.midi), [73, 72]);
});

test("all enclosure patterns preserve surrounding order and exact target resolution", async () => {
    const { engine } = await fixture();
    const expected = {
        "chromatic-above-below": ["chromatic-above", "chromatic-below"], "chromatic-below-above": ["chromatic-below", "chromatic-above"],
        "diatonic-above-below": ["diatonic-above", "diatonic-below"], "diatonic-below-above": ["diatonic-below", "diatonic-above"],
        "diatonic-above-chromatic-below": ["diatonic-above", "chromatic-below"], "chromatic-below-diatonic-above": ["chromatic-below", "diatonic-above"]
    };
    for (const pattern of ENCLOSURE_PATTERNS) {
        const step = engine.generate({ type: "enclosure", root: "D", quality: "minor-7", target: "third", enclosurePattern: pattern }).rows[0].steps[0];
        assert.equal(step.simultaneous, false); assert.equal(step.notes.length, 3); assert.equal(step.metadata.targetChordMember, 3);
        assert.deepEqual(step.metadata.eventRoles.slice(0, 2).map(value => `${value.classification}-${value.direction}`), expected[String(pattern)]);
        assert.equal(step.metadata.eventRoles[2].role, "target"); assert.equal(step.metadata.resolutionTarget, String(step.notes[2]));
    }
});

test("B# enclosure and flat/sharp targets retain spelling and sounding pitch", async () => {
    const { engine } = await fixture();
    const bs = engine.generate({ type: "enclosure", root: "B#", target: "root", enclosurePattern: "diatonic-above-chromatic-below" }).rows[0].steps[0];
    assert.deepEqual(bs.notes.map(String), ["C##5", "B4", "B#4"]); assert.deepEqual(bs.notes.map(note => note.midi), [74, 71, 72]);
    for (const root of ["Db", "F#"]) assert.equal(String(engine.generate({ type: "enclosure", root, target: "root" }).rows[0].steps[0].notes.at(-1).pitchClass), root);
});

test("default progression catalog is immutable, ordered, and rejects duplicates", () => {
    const catalog = new ProgressionCatalog();
    assert.deepEqual(catalog.values().map(String), ["ii-v-i-major", "ii-half-diminished-v-i-minor", "i-vi-ii-v", "twelve-bar-dominant-blues"]);
    assert.ok(Object.isFrozen(catalog) && Object.isFrozen(catalog.values()) && Object.isFrozen(catalog.values()[0].events));
    assert.throws(() => new ProgressionCatalog([defaultProgressions[0], defaultProgressions[0]]), /duplicate/i);
    assert.throws(() => new ProgressionDefinition({ id: "bad", mode: "major", events: [{ degree: 8, quality: "major", romanNumeral: "VIII" }] }), ValidationError);
});

test("progressions preserve harmonic order, Roman numerals, quality, members, and root-position voicing", async () => {
    const { engine } = await fixture();
    const expected = {
        "ii-v-i-major": ["ii7", "V7", "Imaj7"], "ii-half-diminished-v-i-minor": ["iiø7", "V7", "i7"],
        "i-vi-ii-v": ["Imaj7", "vi7", "ii7", "V7"],
        "twelve-bar-dominant-blues": ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"]
    };
    for (const [progression, roman] of Object.entries(expected)) {
        const row = engine.generate({ type: "chord-progression", root: "C", progression }).rows[0];
        assert.deepEqual(row.steps.map(step => step.metadata.romanNumeral), roman); assert.ok(row.steps.every(step => step.simultaneous));
        assert.ok(row.steps.every(step => step.notes[0].midi === Math.min(...step.notes.map(note => note.midi))));
        assert.ok(row.steps.every(step => step.chordMembers.join(",") === "1,3,5,7"));
    }
});

test("progressions preserve exact flat and sharp spellings and canonical all-key order", async () => {
    const { engine } = await fixture();
    const flat = engine.generate({ type: "chord-progression", root: "Db", progression: "ii-v-i-major" }).rows[0];
    assert.deepEqual(flat.steps.map(step => step.metadata.writtenRoot), ["Eb", "Ab", "Db"]);
    const sharp = engine.generate({ type: "chord-progression", root: "F#", progression: "ii-v-i-major" }).rows[0];
    assert.deepEqual(sharp.steps.map(step => step.metadata.writtenRoot), ["G#", "C#", "F#"]);
    assert.deepEqual(engine.generate({ type: "chord-progression", root: "Cb" }).rows[0].steps.map(step => step.metadata.writtenRoot), ["Db", "Gb", "Cb"]);
    assert.deepEqual(engine.generate({ type: "chord-progression", root: "B#" }).rows[0].steps.map(step => step.metadata.writtenRoot), ["C##", "F##", "B#"]);
    const all = engine.generate({ type: "chord-progression", allKeys: true });
    assert.deepEqual(all.rows.map(row => String(row.root)), CANONICAL_EXERCISE_ROOTS); assert.equal(new Set(all.rows.map(row => row.id)).size, 12);
});

test("advanced generation is deterministic, immutable, explicitly selectable, and plugin isolated", async () => {
    const { engine, kernel } = await fixture(); const input = { type: "enclosure", root: "Eb", quality: "dominant-7", target: "all" }; const before = JSON.stringify(input);
    assert.deepEqual(engine.generate(input), engine.generate(input)); assert.equal(JSON.stringify(input), before);
    const explicit = engine.generate({ ...input, pluginId: "core.exercise.advanced", strategyId: "advanced" }); assert.equal(explicit.metadata.pluginId, "core.exercise.advanced");
    assert.throws(() => engine.generate({ ...input, pluginId: "core.exercise.foundational", strategyId: "foundational" }), /does not support/);
    assert.ok(Object.isFrozen(explicit) && Object.isFrozen(explicit.rows[0]) && Object.isFrozen(explicit.rows[0].steps[0].metadata));
    assert.strictEqual(kernel.services.resolve("exercise.progressionCatalog"), kernel.registries.services.resolve("exercise.progressionCatalog"));
});

test("advanced strategy selection is independent of registration order", () => {
    const strategy = new AdvancedExerciseStrategy({ scaleGenerator: new ScaleGenerator(), chordGenerator: new ChordGenerator(), progressionCatalog: new ProgressionCatalog() });
    const other = Object.create(strategy); Object.defineProperties(other, { id: { value: "z-advanced" }, pluginId: { value: "z.plugin" } });
    const request = new ExerciseRequest({ type: "approach-note" }); const a = new ExerciseStrategyRegistry(), b = new ExerciseStrategyRegistry();
    a.register(strategy.pluginId, strategy); a.register(other.pluginId, other); b.register(other.pluginId, other); b.register(strategy.pluginId, strategy);
    assert.strictEqual(a.select(request), strategy); assert.strictEqual(b.select(request), strategy);
});

function injectedModule() {
    const scaleGenerator = new ScaleGenerator(), chordGenerator = new ChordGenerator(), progressionCatalog = new ProgressionCatalog();
    return new ExerciseModule({
        foundationalStrategy: new FoundationalExerciseStrategy({ scaleGenerator, chordGenerator }),
        advancedStrategy: new AdvancedExerciseStrategy({ scaleGenerator, chordGenerator, progressionCatalog }), progressionCatalog
    });
}

test("advanced module registrations preserve collisions and roll back atomically", () => {
    const points = [
        ["container", (k, m, value) => k.services.register("exercise.progressionCatalog", value), k => k.services.resolve("exercise.progressionCatalog", { optional: true }), m => m.progressionCatalog],
        ["service", (k, m, value) => k.registries.services.register(Exercise.serviceDescriptors.progressions, { value }), k => k.registries.services.resolve("exercise.progressionCatalog"), m => m.progressionCatalog],
        ["plugin", (k, m, value) => k.registries.plugins.register(Exercise.advancedPluginDescriptor, { value }), k => k.registries.plugins.resolve("core.exercise.advanced"), m => m.advancedPlugin],
        ["exercise", (k, m, value) => k.registries.exercises.register(Exercise.strategyDescriptors.advanced, { value }), k => k.registries.exercises.resolve("exercise.advanced"), m => m.advancedStrategy]
    ];
    for (const [name, seed, read, owned] of points) for (const same of [false, true]) {
        const kernel = new Kernel(), module = injectedModule(), existing = same ? owned(module) : Object.freeze({ name }); seed(kernel, module, existing);
        assert.throws(() => module.configure(kernel.context), /already registered|Duplicate registration/); assert.strictEqual(read(kernel), existing);
        assert.equal(kernel.services.has("exercise.engine"), false); assert.equal(module.strategyRegistry.strategies("core.exercise.foundational").length, 0);
        assert.equal(module.strategyRegistry.strategies("core.exercise.advanced").length, 0);
    }
});

test("advanced listener failures roll back and disposal preserves post-configuration replacements", () => {
    const kernel = new Kernel(), failed = injectedModule();
    kernel.registries.plugins.subscribe(event => { if (String(event.record?.id) === "core.exercise.advanced" && event.type === "registered") throw new Error("advanced listener failed"); });
    assert.throws(() => failed.configure(kernel.context), /advanced listener failed/); assert.equal(kernel.services.has("exercise.engine"), false); assert.equal(kernel.services.has("exercise.progressionCatalog"), false);
    const cleanKernel = new Kernel(), module = injectedModule(); module.configure(cleanKernel.context); const replacement = Object.freeze({ replacement: true });
    cleanKernel.services.register("exercise.progressionCatalog", replacement, { replace: true }); module.dispose(); assert.strictEqual(cleanKernel.services.resolve("exercise.progressionCatalog"), replacement);
    assert.strictEqual(module.progressionCatalog.values, ProgressionCatalog.prototype.values); cleanKernel.services.unregister("exercise.progressionCatalog"); module.configure(cleanKernel.context); module.dispose(); module.dispose();
});

test("a new configure lifecycle binds the current caller-owned progression catalog service", async () => {
    const kernel = new Kernel().use(new TheoryModule()); await kernel.start(); const module = new ExerciseModule(); module.configure(kernel.context); const first = module.progressionCatalog; module.dispose();
    const replacement = new ProgressionCatalog([defaultProgressions[2]]); kernel.services.register("exercise.progressionCatalog", replacement); module.configure(kernel.context);
    assert.notStrictEqual(module.progressionCatalog, first); assert.strictEqual(module.progressionCatalog, replacement); assert.strictEqual(module.advancedStrategy.progressionCatalog, replacement);
    module.dispose(); assert.strictEqual(kernel.services.resolve("exercise.progressionCatalog"), replacement);
});

test("same-object collisions preserve every exact configure-time ExerciseModule value", () => {
    const points = [
        ["container-engine", (k, m, value) => k.services.register("exercise.engine", value), k => k.services.resolve("exercise.engine", { optional: true }), m => m.engine],
        ["container-strategies", (k, m, value) => k.services.register("exercise.strategyRegistry", value), k => k.services.resolve("exercise.strategyRegistry", { optional: true }), m => m.strategyRegistry],
        ["container-progressions", (k, m, value) => k.services.register("exercise.progressionCatalog", value), k => k.services.resolve("exercise.progressionCatalog", { optional: true }), m => m.progressionCatalog],
        ["descriptor-engine", (k, m, value) => k.registries.services.register(Exercise.serviceDescriptors.engine, { value }), k => k.registries.services.resolve("exercise.engine"), m => m.engine],
        ["descriptor-strategies", (k, m, value) => k.registries.services.register(Exercise.serviceDescriptors.strategies, { value }), k => k.registries.services.resolve("exercise.strategy-registry"), m => m.strategyRegistry],
        ["descriptor-progressions", (k, m, value) => k.registries.services.register(Exercise.serviceDescriptors.progressions, { value }), k => k.registries.services.resolve("exercise.progressionCatalog"), m => m.progressionCatalog],
        ["plugin-foundational", (k, m, value) => k.registries.plugins.register(Exercise.pluginDescriptor, { value }), k => k.registries.plugins.resolve("core.exercise.foundational"), m => m.plugin],
        ["plugin-advanced", (k, m, value) => k.registries.plugins.register(Exercise.advancedPluginDescriptor, { value }), k => k.registries.plugins.resolve("core.exercise.advanced"), m => m.advancedPlugin],
        ["exercise-foundational", (k, m, value) => k.registries.exercises.register(Exercise.strategyDescriptors.foundational, { value }), k => k.registries.exercises.resolve("exercise.foundational"), m => m.foundationalStrategy],
        ["exercise-advanced", (k, m, value) => k.registries.exercises.register(Exercise.strategyDescriptors.advanced, { value }), k => k.registries.exercises.resolve("exercise.advanced"), m => m.advancedStrategy]
    ];
    for (const [name, seed, read, intended] of points) {
        const kernel = new Kernel(), module = injectedModule(), unrelated = Object.freeze({ name: "unrelated" }); kernel.services.register("unrelated", unrelated);
        const exact = intended(module); seed(kernel, module, exact); assert.throws(() => module.configure(kernel.context), /already registered|Duplicate registration/);
        assert.strictEqual(read(kernel), exact, name); assert.strictEqual(kernel.services.resolve("unrelated"), unrelated);
        assert.equal(module.strategyRegistry.strategies("core.exercise.foundational").length, 0); assert.equal(module.strategyRegistry.strategies("core.exercise.advanced").length, 0);
        for (const id of ["exercise.engine", "exercise.strategyRegistry", "exercise.progressionCatalog"]) if (!name.startsWith(`container-${id === "exercise.engine" ? "engine" : id === "exercise.strategyRegistry" ? "strategies" : "progressions"}`)) assert.equal(kernel.services.has(id), false, `${name} leaked ${id}`);
        assert.equal(kernel.registries.services.size, name.startsWith("descriptor-") ? 1 : 0, `${name} leaked service descriptors`);
        assert.equal(kernel.registries.plugins.size, name.startsWith("plugin-") ? 1 : 0, `${name} leaked plugins`);
        assert.equal(kernel.registries.exercises.size, name.startsWith("exercise-") ? 1 : 0, `${name} leaked exercise descriptors`);
    }
});

test("injected plugins are stable while dynamic plugins follow active Theory lifecycles", async () => {
    const injected = injectedModule(), injectedKernel = new Kernel(), foundationalPlugin = injected.plugin, advancedPlugin = injected.advancedPlugin;
    assert.strictEqual(foundationalPlugin.strategies[0], injected.foundationalStrategy); assert.strictEqual(advancedPlugin.strategies[0], injected.advancedStrategy);
    injected.configure(injectedKernel.context); assert.strictEqual(injected.plugin, foundationalPlugin); assert.strictEqual(injected.advancedPlugin, advancedPlugin); injected.dispose(); injected.dispose();
    injected.configure(injectedKernel.context); assert.strictEqual(injected.plugin, foundationalPlugin); assert.strictEqual(injected.advancedPlugin, advancedPlugin); injected.dispose();

    const kernel = new Kernel().use(new TheoryModule()); await kernel.start(); const dynamic = new ExerciseModule(); dynamic.configure(kernel.context);
    const firstFoundational = dynamic.foundationalStrategy, firstAdvanced = dynamic.advancedStrategy, firstPlugin = dynamic.plugin, firstAdvancedPlugin = dynamic.advancedPlugin; dynamic.dispose();
    kernel.services.register("theory.scaleGenerator", new ScaleGenerator(), { replace: true }); kernel.services.register("theory.chordGenerator", new ChordGenerator(), { replace: true });
    dynamic.configure(kernel.context); assert.notStrictEqual(dynamic.foundationalStrategy, firstFoundational); assert.notStrictEqual(dynamic.advancedStrategy, firstAdvanced);
    assert.notStrictEqual(dynamic.plugin, firstPlugin); assert.notStrictEqual(dynamic.advancedPlugin, firstAdvancedPlugin);
    assert.strictEqual(dynamic.plugin.strategies[0], dynamic.foundationalStrategy); assert.strictEqual(dynamic.advancedPlugin.strategies[0], dynamic.advancedStrategy);
    const replacement = Object.freeze({ replacement: "advanced-plugin" }); kernel.registries.plugins.register(Exercise.advancedPluginDescriptor, { value: replacement, replace: true }); dynamic.dispose();
    assert.strictEqual(kernel.registries.plugins.resolve("core.exercise.advanced"), replacement); assert.equal(dynamic.plugin, null); assert.equal(dynamic.advancedPlugin, null);
});

test("notation maps target phrases to ordered notes and progression events to independent chords", async () => {
    const { kernel, engine } = await fixture(); const notation = kernel.services.resolve("exercise.notation.engine");
    for (const request of [{ type: "approach-note", target: "all", quality: "major-7" }, { type: "enclosure", target: "all", quality: "major-7" }]) {
        const model = engine.generate(request), row = notation.notate(model, { measuresPerSystem: 1 }).rows[0];
        assert.equal(row.graph.nodesOfType("chord").length, 0); assert.ok(row.graph.nodesOfType("note").every(node => node instanceof NoteNode));
        assert.equal(row.graph.edges.filter(edge => String(edge.type) === "next").length, row.eventCount - 1);
    }
    const model = engine.generate({ type: "chord-progression", progression: "twelve-bar-dominant-blues" }), row = notation.notate(model, { measuresPerSystem: 1 }).rows[0];
    assert.equal(row.graph.nodesOfType("chord").length, 12); assert.ok(row.graph.nodesOfType("chord").every(node => node instanceof ChordNode));
    assert.equal(row.graph.edges.filter(edge => String(edge.type) === "next").length, 11); assert.ok(row.systems.length > 1);
    assert.equal(String(notation.notate(model, { keySignaturePolicy: "exercise-root" }).rows[0].graph.nodesOfType("measure")[0].keySignature), "C major");
});

test("advanced semantic metadata remains deeply immutable through notation and presentation", async () => {
    const { kernel, application } = await fixture();
    const approach = application.run({ exercise: { type: "approach-note", root: "Cb", quality: "major-7", target: "third", approachPattern: "diatonic-below" } });
    const approachRow = approach.presentation.rows[0]; assert.strictEqual(approachRow.graph, approachRow.notationRow.graph); assert.strictEqual(approachRow.sourceRow, approach.model.rows[0]);
    assert.equal(String(approach.request.exercise.type), "approach-note");
    const approachNodes = approachRow.graph.nodesOfType("note"), sourceStep = approach.model.rows[0].steps[0];
    assert.deepEqual(approachNodes[0].metadata.attributes.stepMetadata, sourceStep.metadata); assert.equal(approachNodes[0].metadata.attributes.stepMetadata.pattern, "diatonic-below");
    assert.deepEqual(approachNodes[0].metadata.attributes.eventRole, { role: "approach", direction: "below", classification: "diatonic" });
    assert.equal(approachNodes[0].metadata.attributes.stepMetadata.targetChordMember, 3); assert.equal(approachNodes[1].metadata.attributes.eventRole.role, "target");
    assert.equal(approachNodes[1].metadata.attributes.eventRole.chordMember, 3); assert.equal(approachNodes[1].metadata.attributes.stepMetadata.resolutionTarget, String(approachNodes[1].pitch));
    assert.ok(Object.isFrozen(approachNodes[0].metadata.attributes.stepMetadata) && Object.isFrozen(approachNodes[0].metadata.attributes.stepMetadata.eventRoles));
    assert.ok(Object.isFrozen(approachNodes[0].metadata.attributes.eventRole)); assert.notStrictEqual(approachNodes[0].metadata.attributes.stepMetadata, sourceStep.metadata);

    const enclosure = application.run({ exercise: { type: "enclosure", root: "B#", target: "root", enclosurePattern: "diatonic-above-chromatic-below" } });
    assert.deepEqual(enclosure.presentation.rows[0].graph.nodesOfType("note").map(node => node.metadata.attributes.eventRole), [
        { role: "surrounding", direction: "above", classification: "diatonic" },
        { role: "surrounding", direction: "below", classification: "chromatic" },
        { role: "target", chordMember: 1, resolvesFrom: 2 }
    ]);

    const progression = application.run({ exercise: { type: "chord-progression", root: "Db", progression: "ii-v-i-major" } });
    const chord = progression.presentation.rows[0].graph.nodesOfType("chord")[0], metadata = chord.metadata.attributes.stepMetadata;
    assert.strictEqual(progression.presentation.rows[0].graph, progression.presentation.rows[0].notationRow.graph); assert.equal(chord.metadata.attributes.eventRole, undefined);
    assert.deepEqual({ progressionId: metadata.progressionId, harmonicEventId: metadata.harmonicEventId, romanNumeral: metadata.romanNumeral, harmonicFunction: metadata.harmonicFunction, chordQuality: metadata.chordQuality, writtenRoot: metadata.writtenRoot, sourceKey: metadata.sourceKey, sourceMode: metadata.sourceMode, voicing: metadata.voicing },
        { progressionId: "ii-v-i-major", harmonicEventId: "ii-v-i-major:event:1", romanNumeral: "ii7", harmonicFunction: "predominant", chordQuality: "minor-7", writtenRoot: "Eb", sourceKey: "Db", sourceMode: "major", voicing: "root-position-close" });
    assert.deepEqual(metadata.writtenChordNotes, chord.notes.map(String)); assert.deepEqual(chord.metadata.attributes.memberOrder, [1, 3, 5, 7]);
    assert.ok(Object.isFrozen(metadata) && Object.isFrozen(metadata.writtenChordNotes) && Object.isFrozen(chord.metadata.attributes.memberOrder));
    assert.strictEqual(kernel.services.resolve("exercise.application.engine"), application);
});

test("notation rejects malformed event-role alignment without mutating semantic rows", async () => {
    const { kernel, engine } = await fixture(); const notation = kernel.services.resolve("exercise.notation.engine"), source = engine.generate({ type: "approach-note", target: "root" });
    const originalRow = source.rows[0], originalStep = originalRow.steps[0], before = JSON.stringify(originalRow);
    const malformedMetadata = [
        { ...originalStep.metadata, eventRoles: [originalStep.metadata.eventRoles[0]] },
        { ...originalStep.metadata, eventRoles: [...originalStep.metadata.eventRoles].reverse() }
    ];
    for (const metadata of malformedMetadata) {
        const step = new ExerciseStep({ ...originalStep, metadata }); const row = new ExerciseRow({ ...originalRow, steps: [step] });
        const section = new ExerciseSection({ ...source.sections[0], rows: [row] }); const model = new ExerciseModel({ ...source, sections: [section] });
        assert.throws(() => notation.notate(model), /eventRoles|event roles/); assert.equal(JSON.stringify(originalRow), before);
    }
});

test("ExerciseApplication generically renders every advanced family with authoritative identities", async () => {
    const { application } = await fixture();
    for (const exercise of [{ type: "approach-note", root: "Cb", target: "root" }, { type: "enclosure", root: "B#", target: "root" }, { type: "chord-progression", progression: "ii-v-i-major" }]) {
        const result = application.run({ exercise }); assert.strictEqual(result.presentation.model, result.model);
        assert.strictEqual(result.presentation.rows[0].sourceRow, result.model.rows[0]); assert.match(result.presentation.rows[0].content, /^<svg/);
        assert.equal(result.presentation.rows[0].rendererPluginId, "core.rendering.svg");
    }
});

test("public v8.4 Core API exposes frozen advanced contracts for the v8.5 Web adapter", async () => {
    assert.equal(String(Exercise.descriptor.version), "8.4.0"); assert.strictEqual(Exercise.AdvancedExerciseStrategy, AdvancedExerciseStrategy);
    assert.deepEqual(APPROACH_PATTERNS.map(String), ["chromatic-below", "chromatic-above", "diatonic-below", "diatonic-above"]);
    assert.deepEqual(CHORD_TARGETS.map(String), ["root", "third", "fifth", "seventh", "all"]); assert.equal(Object.isFrozen(Exercise), true);
    const web = await import("../src/web/exercise/workflow.js");
    assert.deepEqual(web.advancedExerciseFamilyOptions.map(value => value.id), ["approach-note", "enclosure", "chord-progression"]);
});
