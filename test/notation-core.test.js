import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordGenerator,
    GenerationResult,
    ChordNode,
    Clef,
    Duration,
    Kernel,
    MeasureNode,
    KeySignature,
    Notation,
    NotationEngine,
    NotationModule,
    NotationStrategy,
    NotationStrategyRegistry,
    NoteNode,
    PartNode,
    Rest,
    RestNode,
    Scale,
    ScaleGenerator,
    ScalePattern,
    ScoreEdge,
    ScoreGraph,
    ScoreRootNode,
    TheoryEdge,
    TheoryGraph,
    TheoryNode,
    TheoryModule,
    TraversalOrder,
    VoiceNode,
    defaultNotationPluginDescriptor,
    notationRendererDescriptors,
    notationServiceDescriptors,
    notationPackageDescriptor
} from "../src/core/index.js";

function minimalScore(event = new NoteNode({ id: "note:1", pitch: "C4", duration: { numerator: 1, denominator: 4 } })) {
    return new ScoreGraph({
        nodes: [
            new ScoreRootNode({ id: "score", title: "Test" }),
            new PartNode({ id: "part:1" }),
            new MeasureNode({ id: "measure:1", number: 1 }),
            new VoiceNode({ id: "voice:1" }),
            event
        ],
        edges: [
            new ScoreEdge({ from: "score", to: "part:1" }),
            new ScoreEdge({ from: "part:1", to: "measure:1" }),
            new ScoreEdge({ from: "measure:1", to: "voice:1" }),
            new ScoreEdge({ from: "voice:1", to: event.id })
        ]
    });
}

test("durations normalize fractions and reject invalid values", () => {
    const duration = new Duration({ numerator: 2, denominator: 8 });
    assert.equal(String(duration), "1/4");
    assert.equal(duration.wholeNotes, 0.25);
    assert.ok(Object.isFrozen(duration));
    assert.throws(() => new Duration({ numerator: 0, denominator: 4 }), /positive integer/);
});

test("rests are immutable timed values with validated durations and offsets", () => {
    const rest = new Rest({ duration: { numerator: 1, denominator: 8 }, offset: 1.5 });
    assert.equal(String(rest.duration), "1/8");
    assert.equal(rest.offset, 1.5);
    assert.ok(Object.isFrozen(rest));
    assert.ok(Object.isFrozen(rest.duration));
    assert.throws(() => new Rest({ duration: { numerator: 0, denominator: 4 } }), /positive integer/);
    assert.throws(() => new Rest({ offset: -1 }), /non-negative/);
});

test("clefs validate supported types, staff lines, and octave shifts", () => {
    assert.deepEqual(new Clef("treble").toObject(), { type: "treble", line: 2, octaveShift: 0 });
    assert.equal(new Clef({ type: "bass", octaveShift: -1 }).line, 4);
    assert.throws(() => new Clef("tablature"), /Unsupported clef/);
    assert.throws(() => new Clef({ type: "alto", line: 6 }), /line must be an integer from 1 through 5/);
    assert.throws(() => new Clef({ type: "tenor", octaveShift: 3 }), /octave shift/);
    assert.deepEqual(["treble", "bass", "alto", "tenor", "percussion"].map(type => String(new Clef(type))),
        ["treble", "bass", "alto", "tenor", "percussion"]);
});

test("key signatures validate tonic, mode, spelling, and accidental ranges", () => {
    const sharpKey = new KeySignature({ tonic: "F#", mode: "major" });
    const flatKey = new KeySignature({ tonic: "Eb", mode: "minor" });
    assert.equal(sharpKey.accidentals, 6);
    assert.equal(sharpKey.sharps, 6);
    assert.equal(flatKey.accidentals, -6);
    assert.equal(flatKey.flats, 6);
    assert.equal(String(flatKey), "Eb minor");
    assert.ok(Object.isFrozen(flatKey.tonic));
    assert.throws(() => new KeySignature({ tonic: "C", mode: "dorian" }), /Unsupported key-signature mode/);
    assert.throws(() => new KeySignature({ tonic: "C#", mode: "minor", accidentals: 8 }), /from -7 through 7/);
    assert.throws(() => new KeySignature({ tonic: "C", mode: "major", accidentals: 1 }), /requires 0/);
    assert.throws(() => new KeySignature({ tonic: "D#", mode: "major" }), /Unsupported major key signature tonic/);
    assert.equal(new KeySignature({ tonic: "C#", mode: "major" }).accidentals, 7);
    assert.equal(new KeySignature({ tonic: "Cb", mode: "major" }).accidentals, -7);
    assert.equal(new KeySignature({ tonic: "A#", mode: "minor" }).accidentals, 7);
    assert.equal(new KeySignature({ tonic: "Ab", mode: "minor" }).accidentals, -7);
});

test("score-domain nodes are typed and deeply immutable", () => {
    const note = new NoteNode({ id: "note:1", pitch: "F#4", duration: { numerator: 1, denominator: 8 }, offset: 0.5 });
    const chord = new ChordNode({ id: "chord:1", notes: ["C4", "E4", "G4"], duration: 1 });
    assert.equal(String(note.type), "note");
    assert.equal(String(note.pitch), "F#4");
    assert.equal(String(chord.type), "chord");
    assert.deepEqual(chord.notes.map(String), ["C4", "E4", "G4"]);
    assert.ok(Object.isFrozen(note.value));
    assert.ok(Object.isFrozen(chord.notes));
    assert.throws(() => chord.notes.push("B4"), TypeError);
});

test("parts and measures own immutable clef and key-signature data", () => {
    const part = new PartNode({ id: "part:1", clef: { type: "bass", line: 4 } });
    const measure = new MeasureNode({ id: "measure:1", number: 1, keySignature: { tonic: "Bb", mode: "major" } });
    assert.ok(part.clef instanceof Clef);
    assert.equal(String(part.clef), "bass");
    assert.ok(measure.keySignature instanceof KeySignature);
    assert.equal(measure.keySignature.accidentals, -2);
    assert.ok(Object.isFrozen(part.clef));
    assert.ok(Object.isFrozen(measure.keySignature));
    assert.throws(() => { part.clef.type = "treble"; }, TypeError);
    assert.throws(() => { measure.keySignature.accidentals = 0; }, TypeError);
});

test("ScoreGraph specializes TheoryGraph with deterministic traversal", () => {
    const score = minimalScore();
    assert.ok(score instanceof TheoryGraph);
    assert.equal(score.score.title, "Test");
    assert.deepEqual(score.traverse("score").map(String), ["score", "part:1", "measure:1", "voice:1", "note:1"]);
    assert.deepEqual(score.traverse("score", { order: TraversalOrder.DEPTH_FIRST }).map(String), ["score", "part:1", "measure:1", "voice:1", "note:1"]);
    assert.equal(score.nodesOfType("note").length, 1);
    assert.ok(Object.isFrozen(score));
    assert.ok(Object.isFrozen(score.nodes));
});

test("rests participate in voice containment and deterministic event sequencing", () => {
    const rest = new RestNode({ id: "rest:1", duration: { numerator: 1, denominator: 4 }, offset: 1 });
    const score = new ScoreGraph({
        nodes: [
            new ScoreRootNode({ id: "score" }),
            new PartNode({ id: "part:1" }),
            new MeasureNode({ id: "measure:1", number: 1 }),
            new VoiceNode({ id: "voice:1" }),
            new NoteNode({ id: "note:1", pitch: "C4" }),
            rest
        ],
        edges: [
            new ScoreEdge({ from: "score", to: "part:1" }),
            new ScoreEdge({ from: "part:1", to: "measure:1" }),
            new ScoreEdge({ from: "measure:1", to: "voice:1" }),
            new ScoreEdge({ from: "voice:1", to: "note:1" }),
            new ScoreEdge({ from: "voice:1", to: "rest:1" }),
            new ScoreEdge({ from: "note:1", to: "rest:1", type: "next" })
        ]
    });
    assert.ok(score.nodesOfType("rest")[0].equals(rest));
    assert.equal(String(rest.duration), "1/4");
    assert.deepEqual(score.traverse("voice:1").map(String), ["voice:1", "note:1", "rest:1"]);
});

test("ScoreGraph rejects duplicate nodes, missing endpoints, and invalid hierarchy", () => {
    assert.throws(() => new ScoreGraph({
        nodes: [new ScoreRootNode({ id: "score" }), new ScoreRootNode({ id: "score" })]
    }), /exactly one score node|Duplicate theory node id/);

    assert.throws(() => new ScoreGraph({
        nodes: [new ScoreRootNode({ id: "score" })],
        edges: [new ScoreEdge({ from: "score", to: "missing" })]
    }), /references a missing node/);

    assert.throws(() => new ScoreGraph({
        nodes: [new ScoreRootNode({ id: "score" }), new VoiceNode({ id: "voice:1" })],
        edges: [new ScoreEdge({ from: "score", to: "voice:1" })]
    }), /score cannot contain voice/);

    assert.throws(() => new ScoreGraph({
        nodes: [new ScoreRootNode({ id: "score" }), new PartNode({ id: "orphan" })]
    }), /not contained/);
});

test("ScoreGraph rejects ambiguous and cyclic event sequences", () => {
    const nodes = [
        new ScoreRootNode({ id: "score" }),
        new PartNode({ id: "part:1" }),
        new MeasureNode({ id: "measure:1", number: 1 }),
        new VoiceNode({ id: "voice:1" }),
        new NoteNode({ id: "note:1", pitch: "C4" }),
        new NoteNode({ id: "note:2", pitch: "D4" })
    ];
    const containment = [
        new ScoreEdge({ from: "score", to: "part:1" }),
        new ScoreEdge({ from: "part:1", to: "measure:1" }),
        new ScoreEdge({ from: "measure:1", to: "voice:1" }),
        new ScoreEdge({ from: "voice:1", to: "note:1" }),
        new ScoreEdge({ from: "voice:1", to: "note:2" })
    ];
    assert.throws(() => new ScoreGraph({
        nodes,
        edges: [
            ...containment,
            new ScoreEdge({ from: "note:1", to: "note:2", type: "next" }),
            new ScoreEdge({ from: "note:2", to: "note:1", type: "next" })
        ]
    }), /must not contain a cycle/);
});

test("default scale notation produces deterministic sequential note events", () => {
    const result = new ScaleGenerator().generateResult("C", "major");
    const registry = new NotationStrategyRegistry();
    const module = new NotationModule({ strategyRegistry: registry });
    const first = module.engine.notate(result, { octave: 4 });
    const second = module.engine.notate(result, { octave: 4 });
    assert.deepEqual(first.nodesOfType("note").map(node => String(node.pitch)), ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]);
    assert.equal(first.edges.filter(edge => String(edge.type) === "next").length, 6);
    assert.equal(String(first.nodesOfType("part")[0].clef), "treble");
    assert.equal(String(first.nodesOfType("measure")[0].keySignature), "C major");
    assert.ok(first.equals(second));
});

test("default chord notation produces one immutable chord event", () => {
    const result = new ChordGenerator().generateResult("Bb", "dominant-7", { prefer: "flats" });
    const module = new NotationModule();
    const score = module.engine.notate(result, { octave: 3 });
    const [event] = score.nodesOfType("chord");
    assert.ok(event instanceof ChordNode);
    assert.deepEqual(event.notes.map(String), ["Bb3", "D4", "F4", "Ab4"]);
    assert.equal(score.score.title, "Bb7");
});

test("notation preserves exact flat and sharp pitch-class spellings", () => {
    const engine = new NotationModule().engine;
    const cases = [
        {
            root: "Eb",
            pitchClasses: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
            expected: ["Eb4", "F4", "G4", "Ab4", "Bb4", "C5", "D5"]
        },
        {
            root: "F#",
            pitchClasses: ["F#", "G#", "A#", "B", "C#", "D#", "E#"],
            expected: ["F#4", "G#4", "A#4", "B4", "C#5", "D#5", "E#5"]
        },
        {
            root: "C#",
            pitchClasses: ["C#", "D#", "E#", "F#", "G#", "A#", "B#"],
            expected: ["C#4", "D#4", "E#4", "F#4", "G#4", "A#4", "B#4"]
        },
        {
            root: "Cb",
            pitchClasses: ["Cb", "Db", "Eb", "Fb", "Gb", "Ab", "Bb"],
            expected: ["Cb4", "Db4", "Eb4", "Fb4", "Gb4", "Ab4", "Bb4"]
        }
    ];
    const pattern = new ScalePattern({ id: "spelled-major", name: "Spelled Major", intervals: [0, 2, 4, 5, 7, 9, 11] });
    for (const entry of cases) {
        const model = new Scale({ root: entry.root, pattern, pitchClasses: entry.pitchClasses });
        const result = GenerationResult.fromModel(model, "test.spelling-generator");
        assert.deepEqual(engine.notate(result, { octave: 4 }).nodesOfType("note").map(node => String(node.pitch)), entry.expected);
    }
});

test("notation preserves explicit source Note spelling and octave information", () => {
    const result = new ScaleGenerator().generateResult("C", "major");
    const sourceNotes = ["B#3", "D4", "E4", "F4", "G4", "A4", "B4"];
    const score = new NotationModule().engine.notate(result, { notes: sourceNotes, octave: 8 });
    assert.deepEqual(score.nodesOfType("note").map(node => String(node.pitch)), sourceNotes);
    assert.equal(score.nodesOfType("note")[0].pitch.midi, 60);
    assert.throws(() => new NotationModule().engine.notate(result, { notes: ["C4"] }), /tone count/);
    assert.throws(() => new NotationModule().engine.notate(result, {
        notes: ["C#4", "D4", "E4", "F4", "G4", "A4", "B4"]
    }), /does not match/);
});

test("GenerationResult and deterministically reordered TheoryGraph inputs produce equivalent scores", () => {
    const result = new ScaleGenerator().generateResult("Eb", "major", { prefer: "flats" });
    const engine = new NotationModule().engine;
    const reordered = new TheoryGraph({ nodes: [...result.graph.nodes].reverse(), edges: [...result.graph.edges].reverse() });
    const fromResult = engine.notate(result, { octave: 3 });
    const fromGraph = engine.notate(reordered, { octave: 3 });
    assert.ok(fromResult.equals(fromGraph));
    assert.deepEqual(fromGraph.nodesOfType("note").map(node => String(node.pitch)), ["Eb3", "F3", "G3", "Ab3", "Bb3", "C4", "D4"]);
});

test("chord GenerationResult and TheoryGraph inputs produce equivalent scores", () => {
    const result = new ChordGenerator().generateResult("Bb", "minor-7", { prefer: "flats" });
    const engine = new NotationModule().engine;
    const fromResult = engine.notate(result, { octave: 2 });
    const fromGraph = engine.notate(result.graph, { octave: 2 });
    assert.ok(fromResult.equals(fromGraph));
    assert.deepEqual(fromGraph.nodesOfType("chord")[0].notes.map(String), ["Bb2", "Db3", "F3", "Ab3"]);
});

test("TheoryGraph conversion preserves ordered degree metadata and source spelling", () => {
    const pattern = new ScalePattern({ id: "f-sharp-major", intervals: [0, 2, 4, 5, 7, 9, 11] });
    const model = new Scale({ root: "F#", pattern, pitchClasses: ["F#", "G#", "A#", "B", "C#", "D#", "E#"] });
    const result = GenerationResult.fromModel(model, "test.graph-generator");
    const toneEdges = result.graph.edges.filter(edge => String(edge.type) === "contains-tone");
    assert.deepEqual(toneEdges.map(edge => edge.metadata.attributes.degree), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(toneEdges.map(edge => edge.metadata.attributes.semitones), [0, 2, 4, 5, 7, 9, 11]);
    const score = new NotationModule().engine.notate(result.graph, { octave: 4 });
    assert.deepEqual(score.nodesOfType("note").map(node => String(node.pitch)), ["F#4", "G#4", "A#4", "B4", "C#5", "D#5", "E#5"]);
});

test("TheoryGraph conversion rejects unsupported outputs and malformed tone metadata", () => {
    const engine = new NotationModule().engine;
    const unsupported = new TheoryGraph({ nodes: [new TheoryNode({ id: "output:mode", type: "mode" })] });
    assert.throws(() => engine.notate(unsupported), /exactly one scale or chord output/);

    const result = new ScaleGenerator().generateResult("C", "major");
    const missingDegreeEdges = result.graph.edges.map(edge => String(edge.id) === "output:scale:contains-tone:tone:2"
        ? new TheoryEdge({
            id: edge.id, from: edge.from, to: edge.to, type: edge.type,
            metadata: { attributes: { semitones: 2 } }
        })
        : edge);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: result.graph.nodes, edges: missingDegreeEdges })), /positive integer degree/);

    const duplicateDegreeEdges = result.graph.edges.map(edge => String(edge.id) === "output:scale:contains-tone:tone:2"
        ? new TheoryEdge({
            id: edge.id, from: edge.from, to: edge.to, type: edge.type,
            metadata: { attributes: { degree: 1, semitones: 2 } }
        })
        : edge);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: result.graph.nodes, edges: duplicateDegreeEdges })), /unique and contiguous/);

    const misspelledNodes = result.graph.nodes.map(node => String(node.id) === "tone:2"
        ? new TheoryNode({ id: node.id, type: node.type, value: "Db" })
        : node);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: misspelledNodes, edges: result.graph.edges })), /does not match its root and interval/);
});

test("TheoryGraph conversion rejects missing, duplicate, and mistyped structural edges", () => {
    const engine = new NotationModule().engine;
    const result = new ScaleGenerator().generateResult("C", "major");
    const without = type => result.graph.edges.filter(edge => String(edge.type) !== type);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: result.graph.nodes, edges: without("rooted-at") })), /exactly one rooted-at/);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: result.graph.nodes, edges: without("uses-pattern") })), /exactly one uses-pattern/);
    assert.throws(() => engine.notate(new TheoryGraph({
        nodes: result.graph.nodes,
        edges: [...result.graph.edges, new TheoryEdge({ id: "second-root", from: "output:scale", to: "input:root", type: "rooted-at" })]
    })), /exactly one rooted-at/);

    const mistypedRoot = result.graph.nodes.map(node => String(node.id) === "input:root"
        ? new TheoryNode({ id: node.id, type: "scale-pattern", value: node.value })
        : node);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: mistypedRoot, edges: result.graph.edges })), /root edge must target a pitch-class/);
});

test("TheoryGraph conversion rejects tone-count, interval, and output ambiguity", () => {
    const engine = new NotationModule().engine;
    const result = new ScaleGenerator().generateResult("C", "major");
    const fewerTones = result.graph.edges.filter(edge => String(edge.id) !== "output:scale:contains-tone:tone:7");
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: result.graph.nodes, edges: fewerTones })), /tone count must match/);

    const wrongInterval = result.graph.edges.map(edge => String(edge.id) === "output:scale:contains-tone:tone:2"
        ? new TheoryEdge({
            id: edge.id, from: edge.from, to: edge.to, type: edge.type,
            metadata: { attributes: { degree: 2, semitones: 3 } }
        })
        : edge);
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: result.graph.nodes, edges: wrongInterval })), /does not match its pattern interval/);

    const secondOutput = new TheoryNode({ id: "output:chord", type: "chord" });
    assert.throws(() => engine.notate(new TheoryGraph({ nodes: [...result.graph.nodes, secondOutput], edges: result.graph.edges })), /exactly one scale or chord output/);
});

test("notation strategies remain isolated by plugin scope", () => {
    class CustomStrategy extends NotationStrategy {
        constructor(pluginId) { super({ id: "shared", pluginId, inputType: "scale" }); }
        supports(result) { return result.model?.pattern?.id?.toString() === "major"; }
        notate() { return minimalScore(); }
    }
    const strategies = new NotationStrategyRegistry();
    const first = new CustomStrategy("plugin.first");
    const second = new CustomStrategy("plugin.second");
    strategies.register("plugin.first", first);
    strategies.register("plugin.second", second);
    assert.throws(() => strategies.register("plugin.first", first), /already registered/);
    assert.equal(strategies.get("plugin.first", "shared"), first);
    assert.equal(strategies.get("plugin.second", "shared"), second);
    assert.equal(strategies.select(new ScaleGenerator().generateResult("C"), { pluginId: "plugin.second", strategyId: "shared" }), second);
    assert.throws(() => strategies.register("plugin.other", first), /belongs to plugin/);
    assert.equal(strategies.unregisterPlugin("plugin.first"), 1);
    assert.equal(strategies.get("plugin.first", "shared"), null);
});

test("NotationEngine validates inputs, selection, and strategy outputs", () => {
    const engine = new NotationEngine();
    assert.throws(() => engine.notate({}), /requires a GenerationResult/);
    assert.throws(() => engine.notate(new ScaleGenerator().generateResult("C")), /No notation strategy/);

    class BrokenStrategy extends NotationStrategy {
        constructor() { super({ id: "broken", pluginId: "plugin.broken", inputType: "scale" }); }
        supports() { return true; }
        notate() { return {}; }
    }
    engine.registry.register("plugin.broken", new BrokenStrategy());
    assert.throws(() => engine.notate(new ScaleGenerator().generateResult("C")), /did not return a ScoreGraph/);
});

test("NotationModule integrates services, plugin scope, and renderers with Kernel", async () => {
    const kernel = new Kernel().use(new TheoryModule()).use(new NotationModule());
    await kernel.start();

    const result = kernel.context.resolve("theory.scaleGenerator").generateResult("D", "minor-pentatonic");
    const engine = kernel.context.resolve("notation.engine");
    const score = engine.notate(result, { pluginId: "core.notation.defaults", strategyId: "scale" });
    assert.deepEqual(score.nodesOfType("note").map(node => String(node.pitch)), ["D4", "F4", "G4", "A4", "C5"]);
    assert.equal(kernel.registries.packages.resolve("core.notation").id, "core.notation");
    assert.equal(kernel.registries.renderers.resolve("notation.scale").id.toString(), "scale");
    assert.ok(kernel.registries.plugins.has("core.notation.defaults"));
    assert.ok(kernel.registries.services.has("notation.engine"));

    await kernel.dispose();
    await kernel.dispose();
    assert.equal(kernel.services.has("notation.engine"), false);
    assert.equal(kernel.registries.renderers.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
});

test("NotationModule configure rolls back an early service-container collision", () => {
    const kernel = new Kernel();
    const module = new NotationModule();
    const existing = Object.freeze({ owner: "existing" });
    kernel.services.register("notation.engine", existing);

    assert.throws(() => module.configure(kernel.context), /already registered/);
    assert.equal(kernel.services.resolve("notation.engine"), existing);
    assert.equal(kernel.services.has("notation.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
    assert.equal(kernel.registries.renderers.size, 0);
});

test("NotationModule configure rolls back a middle registry collision", () => {
    const kernel = new Kernel();
    const module = new NotationModule();
    const existing = Object.freeze({ owner: "existing" });
    kernel.registries.services.register(notationServiceDescriptors.strategies, { value: existing });

    assert.throws(() => module.configure(kernel.context), /Duplicate registration/);
    assert.equal(kernel.registries.services.resolve("notation.strategy-registry"), existing);
    assert.equal(kernel.registries.services.has("notation.engine"), false);
    assert.equal(kernel.services.has("notation.engine"), false);
    assert.equal(kernel.services.has("notation.strategyRegistry"), false);
    assert.equal(kernel.registries.plugins.size, 0);
    assert.equal(kernel.registries.renderers.size, 0);
});

test("NotationModule configure rolls back a late renderer collision without removing it", () => {
    const kernel = new Kernel();
    const module = new NotationModule();
    const existing = Object.freeze({ owner: "existing" });
    kernel.registries.renderers.register(notationRendererDescriptors.chord, { value: existing });

    assert.throws(() => module.configure(kernel.context), /Duplicate registration/);
    assert.equal(kernel.registries.renderers.resolve("notation.chord"), existing);
    assert.equal(kernel.registries.renderers.has("notation.scale"), false);
    assert.equal(kernel.services.has("notation.engine"), false);
    assert.equal(kernel.services.has("notation.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);

    module.dispose();
    module.dispose();
    assert.equal(kernel.registries.renderers.resolve("notation.chord"), existing);
});

test("NotationModule preserves pre-existing values at every registration collision point", () => {
    const cases = [
        { area: "container", id: "notation.engine" },
        { area: "container", id: "notation.strategyRegistry" },
        { area: "services", descriptor: notationServiceDescriptors.engine },
        { area: "services", descriptor: notationServiceDescriptors.strategies },
        { area: "plugins", descriptor: defaultNotationPluginDescriptor },
        { area: "renderers", descriptor: notationRendererDescriptors.scale },
        { area: "renderers", descriptor: notationRendererDescriptors.chord }
    ];
    for (const scenario of cases) {
        const kernel = new Kernel();
        const module = new NotationModule();
        const existing = Object.freeze({ owner: `existing:${scenario.area}` });
        if (scenario.area === "container") kernel.services.register(scenario.id, existing);
        else kernel.registries[scenario.area].register(scenario.descriptor, { value: existing });

        assert.throws(() => module.configure(kernel.context), /already registered|Duplicate registration/);
        if (scenario.area === "container") assert.equal(kernel.services.resolve(scenario.id), existing);
        else assert.equal(kernel.registries[scenario.area].resolve(scenario.descriptor.id), existing);

        for (const id of ["notation.engine", "notation.strategyRegistry"]) {
            assert.equal(kernel.services.has(id), scenario.area === "container" && scenario.id === id);
        }
        assert.equal(kernel.registries.services.size, scenario.area === "services" ? 1 : 0);
        assert.equal(kernel.registries.plugins.size, scenario.area === "plugins" ? 1 : 0);
        assert.equal(kernel.registries.renderers.size, scenario.area === "renderers" ? 1 : 0);
        module.dispose();
        module.dispose();
    }
});

test("NotationModule configure is idempotent after a successful transaction", () => {
    const kernel = new Kernel();
    const module = new NotationModule();
    assert.equal(module.configure(kernel.context), module);
    assert.equal(module.configure(kernel.context), module);
    assert.equal(kernel.registries.services.size, 2);
    assert.equal(kernel.registries.plugins.size, 1);
    assert.equal(kernel.registries.renderers.size, 2);
    module.dispose();
});

test("NotationModule rolls back a registry record when a registration listener throws", () => {
    const kernel = new Kernel();
    const module = new NotationModule();
    kernel.registries.renderers.subscribe(event => {
        if (event.type === "registered" && String(event.record.id) === "notation.scale") throw new Error("listener failed");
    });

    assert.throws(() => module.configure(kernel.context), /listener failed/);
    assert.equal(kernel.services.has("notation.engine"), false);
    assert.equal(kernel.services.has("notation.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
    assert.equal(kernel.registries.renderers.size, 0);
});

test("NotationModule dispose is idempotent and preserves registrations it no longer owns", () => {
    const kernel = new Kernel();
    const module = new NotationModule();
    module.configure(kernel.context);
    const replacementEngine = Object.freeze({ owner: "replacement" });
    const replacementRenderer = Object.freeze({ owner: "replacement" });
    kernel.services.register("notation.engine", replacementEngine, { replace: true });
    kernel.registries.renderers.register(notationRendererDescriptors.chord, { value: replacementRenderer, replace: true });

    module.dispose();
    module.dispose();
    assert.equal(kernel.services.resolve("notation.engine"), replacementEngine);
    assert.equal(kernel.registries.renderers.resolve("notation.chord"), replacementRenderer);
    assert.equal(kernel.services.has("notation.strategyRegistry"), false);
    assert.equal(kernel.registries.renderers.has("notation.scale"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
});

test("Notation public namespace and package descriptor expose the milestone contract", () => {
    assert.ok(Notation.ScoreGraph);
    assert.ok(Notation.NotationEngine);
    assert.ok(Notation.Rest);
    assert.ok(Notation.RestNode);
    assert.ok(Notation.Clef);
    assert.ok(Notation.KeySignature);
    assert.ok(Object.isFrozen(Notation));
    assert.equal(String(notationPackageDescriptor.id), "core.notation");
});
