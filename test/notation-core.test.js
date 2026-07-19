import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordGenerator,
    ChordNode,
    Duration,
    Kernel,
    MeasureNode,
    Notation,
    NotationEngine,
    NotationModule,
    NotationStrategy,
    NotationStrategyRegistry,
    NoteNode,
    PartNode,
    ScaleGenerator,
    ScoreEdge,
    ScoreGraph,
    ScoreRootNode,
    TheoryGraph,
    TheoryModule,
    TraversalOrder,
    VoiceNode,
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
    assert.equal(kernel.services.has("notation.engine"), false);
    assert.equal(kernel.registries.renderers.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
});

test("Notation public namespace and package descriptor expose the milestone contract", () => {
    assert.ok(Notation.ScoreGraph);
    assert.ok(Notation.NotationEngine);
    assert.ok(Object.isFrozen(Notation));
    assert.equal(String(notationPackageDescriptor.id), "core.notation");
});
