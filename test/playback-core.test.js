import test from "node:test";
import assert from "node:assert/strict";

import {
    ChordNode,
    Foundation,
    Kernel,
    MeasureNode,
    NoteNode,
    PartNode,
    Playback,
    PlaybackDescriptor,
    PlaybackEngine,
    PlaybackEvent,
    PlaybackModule,
    PlaybackPlan,
    PlaybackRequest,
    PlaybackRegistry,
    PlaybackStrategy,
    PlaybackStrategyRegistry,
    RestNode,
    Registries,
    ScoreEdge,
    ScoreGraph,
    ScorePlaybackPlanner,
    ScoreRootNode,
    VoiceNode,
    defaultPlaybackPluginDescriptor,
    playbackPackageDescriptor,
    playbackServiceDescriptors,
    playbackStrategyDescriptors
} from "../src/core/index.js";

function note(id, pitch, duration = { numerator: 1, denominator: 4 }, offset = 0) {
    return new NoteNode({ id, pitch, duration, offset });
}

function rest(id, duration = { numerator: 1, denominator: 4 }, offset = 0) {
    return new RestNode({ id, duration, offset });
}

function chord(id, notes, duration = { numerator: 1, denominator: 4 }, offset = 0) {
    return new ChordNode({ id, notes, duration, offset });
}

function buildScore({ parts, next = [], reverse = false } = {}) {
    const nodes = [new ScoreRootNode({ id: "score", title: "Playback" })];
    const edges = [];
    for (const [partIndex, partSource] of (parts ?? [{ measures: [{ voices: [[]] }] }]).entries()) {
        const part = new PartNode({ id: partSource.id ?? `part:${partIndex + 1}`, name: partSource.name ?? `Part ${partIndex + 1}` });
        nodes.push(part);
        edges.push(new ScoreEdge({ from: "score", to: part.id, type: "contains" }));
        for (const [measureIndex, measureSource] of partSource.measures.entries()) {
            const measure = new MeasureNode({ id: measureSource.id ?? `${part.id}:measure:${measureIndex + 1}`, number: measureSource.number ?? measureIndex + 1 });
            nodes.push(measure);
            edges.push(new ScoreEdge({ from: part.id, to: measure.id, type: "contains" }));
            for (const [voiceIndex, eventValues] of measureSource.voices.entries()) {
                const voice = new VoiceNode({ id: `${measure.id}:voice:${voiceIndex + 1}`, index: voiceIndex + 1 });
                nodes.push(voice, ...eventValues);
                edges.push(new ScoreEdge({ from: measure.id, to: voice.id, type: "contains" }));
                for (const event of eventValues) edges.push(new ScoreEdge({ from: voice.id, to: event.id, type: "contains" }));
            }
        }
    }
    for (const [from, to] of next) edges.push(new ScoreEdge({ from, to, type: "next" }));
    return new ScoreGraph({ nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges });
}

function engine() {
    const registry = new PlaybackStrategyRegistry();
    registry.register("core.playback.score", new ScorePlaybackPlanner());
    return new PlaybackEngine(registry);
}

test("single notes and sequential scales schedule in exact ticks", () => {
    const single = engine().plan(buildScore({ parts: [{ measures: [{ voices: [[note("n1", "C4")]] }] }] }));
    assert.equal(single.resolution, 1);
    assert.equal(single.totalTicks, 1);
    assert.deepEqual(single.events.map(event => [event.writtenPitch, event.startTick, event.durationTicks]), [["C4", 0, 1]]);

    const scale = engine().plan(buildScore({
        parts: [{ measures: [{ voices: [[note("a", "C4", undefined, 0), note("b", "D4", undefined, 1), note("c", "E4", undefined, 2)]] }] }],
        next: [["a", "b"], ["b", "c"]]
    }));
    assert.deepEqual(scale.events.map(event => [event.writtenPitch, event.startTick]), [["C4", 0], ["D4", 1], ["E4", 2]]);
    assert.equal(scale.totalTicks, 3);
});

test("chord members begin simultaneously and retain chord identity", () => {
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [[chord("ch", ["C4", "Eb4", "G4"], { numerator: 1, denominator: 2 })]] }] }] }));
    assert.deepEqual(plan.events.map(event => event.startTick), [0, 0, 0]);
    assert.deepEqual(plan.events.map(event => event.durationTicks), [2, 2, 2]);
    assert.deepEqual(plan.events.map(event => event.chordIndex), [0, 1, 2]);
    assert.ok(plan.events.every(event => event.chordId === "ch" && event.sourceEventId === "ch"));
});

test("rests advance voice time without emitting sounding events", () => {
    const graph = buildScore({
        parts: [{ measures: [{ voices: [[rest("r", { numerator: 1, denominator: 2 }), note("n", "C4")]] }] }],
        next: [["r", "n"]]
    });
    const plan = engine().plan(graph);
    assert.equal(plan.events.length, 1);
    assert.equal(plan.events[0].startTick, 2);
    assert.equal(plan.totalTicks, 3);
});

test("voices and parts schedule independently and overlap", () => {
    const graph = buildScore({ parts: [
        { id: "part:a", measures: [{ voices: [
            [note("a1", "C4", { numerator: 1, denominator: 1 })],
            [note("a2", "E4", { numerator: 1, denominator: 2 }), note("a3", "F4", { numerator: 1, denominator: 2 })]
        ] }] },
        { id: "part:b", measures: [{ voices: [[note("b1", "G3", { numerator: 1, denominator: 2 })]] }] }
    ], next: [["a2", "a3"]] });
    const plan = engine().plan(graph);
    assert.deepEqual(plan.events.filter(event => event.startTick === 0).map(event => event.writtenPitch), ["C4", "E4", "G3"]);
    assert.equal(plan.events.find(event => event.writtenPitch === "F4").startTick, 2);
    assert.equal(plan.totalTicks, 4);
});

test("measures progress after the longest voice in deterministic number order", () => {
    const graph = buildScore({ parts: [{ measures: [
        { number: 2, id: "m2", voices: [[note("m2n", "D4")]] },
        { number: 1, id: "m1", voices: [[note("m1n", "C4", { numerator: 1, denominator: 2 })], [note("m1v2", "G3")]] }
    ] }] });
    const plan = engine().plan(graph);
    assert.equal(plan.events.find(event => event.sourceEventId === "m2n").startTick, 2);
    assert.equal(plan.totalTicks, 3);
});

test("whole, half, quarter, eighth, dotted, and mixed durations derive exact resolution", () => {
    const events = [
        note("whole", "C4", { numerator: 1, denominator: 1 }, 0),
        note("half", "D4", { numerator: 1, denominator: 2 }, 1),
        note("quarter", "E4", { numerator: 1, denominator: 4 }, 2),
        note("eighth", "F4", { numerator: 1, denominator: 8 }, 3),
        note("dotted", "G4", { numerator: 3, denominator: 8 }, 4),
        note("mixed", "A4", { numerator: 1, denominator: 3 }, 5)
    ];
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [events] }] }], next: events.slice(1).map((event, index) => [events[index].id, event.id]) }));
    assert.equal(plan.resolution, 6);
    assert.deepEqual(plan.events.map(event => event.durationTicks), [24, 12, 6, 3, 9, 8]);
    assert.equal(plan.totalTicks, 62);
});

test("resolution derivation uses the minimal common exact timing unit", () => {
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [[
        note("eighth", "C4", { numerator: 1, denominator: 8 }),
        note("twelfth", "D4", { numerator: 1, denominator: 12 }, 1)
    ]] }] }], next: [["eighth", "twelfth"]] }));
    assert.equal(plan.resolution, 6);
    assert.deepEqual(plan.events.map(event => event.durationTicks), [3, 2]);
});

test("custom resolution rejects unrepresentable durations and unsafe timing ranges", () => {
    const eighth = buildScore({ parts: [{ measures: [{ voices: [[note("n", "C4", { numerator: 1, denominator: 8 })]] }] }] });
    assert.throws(() => engine().plan(eighth, { resolution: 1 }), /cannot be represented exactly/);
    const unsafe = buildScore({ parts: [{ measures: [{ voices: [[
        note("x", "C4", { numerator: Number.MAX_SAFE_INTEGER + 1, denominator: 1 })
    ]] }] }] });
    assert.throws(() => engine().plan(unsafe), /safe integer range/);
    const large = Math.floor(Number.MAX_SAFE_INTEGER / 8);
    const overflowEvents = [note("o1", "C4", large), note("o2", "D4", large, 1), note("o3", "E4", large, 2)];
    const overflow = buildScore({ parts: [{ measures: [{ voices: [overflowEvents] }] }], next: [["o1", "o2"], ["o2", "o3"]] });
    assert.throws(() => engine().plan(overflow), /schedule exceeds/);
});

test("tempo and velocity defaults and custom values are validated", () => {
    const graph = buildScore({ parts: [{ measures: [{ voices: [[note("n", "C4")]] }] }] });
    const defaults = engine().plan(graph);
    assert.equal(defaults.request.tempo, 120);
    assert.equal(defaults.request.velocity, 96);
    assert.equal(defaults.events[0].velocity, 96);
    assert.equal(defaults.ticksToSeconds(1), 0.5);
    const custom = engine().plan(graph, { tempo: 90, velocity: 64, resolution: 4 });
    assert.equal(custom.events[0].durationTicks, 4);
    assert.equal(custom.events[0].velocity, 64);
    for (const tempo of [0, -1, Infinity, NaN]) assert.throws(() => engine().plan(graph, { tempo }), /tempo/);
    for (const velocity of [0, 128, 1.5]) assert.throws(() => engine().plan(graph, { velocity }), /velocity/);
});

test("written flats, sharps, Cb, and B# retain spelling and corrected MIDI", () => {
    const events = [note("eb", "Eb4", undefined, 0), note("fs", "F#4", undefined, 1), note("cb", "Cb4", undefined, 2), note("bs", "B#3", undefined, 3)];
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [events] }] }], next: [["eb", "fs"], ["fs", "cb"], ["cb", "bs"]] }));
    assert.deepEqual(plan.events.map(event => [event.writtenPitch, event.midi]), [["Eb4", 63], ["F#4", 66], ["Cb4", 59], ["B#3", 60]]);
});

test("next-edge precedence topologically interleaves disconnected events by offset", () => {
    const events = [note("a", "A4", undefined, 0), note("c", "C5", undefined, 2), note("b", "B4", undefined, 1)];
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [events] }] }], next: [["a", "c"]] }));
    assert.deepEqual(plan.events.map(event => event.sourceEventId), ["a", "b", "c"]);
    assert.deepEqual(plan.events.map(event => event.startTick), [0, 1, 2]);
});

test("independent next chains interleave and equal offsets use node IDs", () => {
    const events = [note("d", "D4", undefined, 2), note("a", "A3", undefined, 0), note("c", "C4", undefined, 2), note("b", "B3", undefined, 0)];
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [events] }] }], next: [["a", "d"], ["b", "c"]] }));
    assert.deepEqual(plan.events.map(event => event.sourceEventId), ["a", "b", "c", "d"]);
    const ties = engine().plan(buildScore({ parts: [{ measures: [{ voices: [[note("z", "G4"), note("a", "C4")]] }] }] }));
    assert.deepEqual(ties.events.map(event => event.sourceEventId), ["a", "z"]);
});

test("reversed node and edge arrays produce equivalent plans without mutating source graphs", () => {
    const source = { parts: [{ measures: [{ voices: [[note("a", "C4"), rest("b", undefined, 1), chord("c", ["E4", "G4"], undefined, 2)]] }] }], next: [["a", "b"], ["b", "c"]] };
    const normal = buildScore(source);
    const reversed = buildScore({ ...source, reverse: true });
    const before = JSON.stringify(normal);
    const first = engine().plan(normal);
    const second = engine().plan(reversed);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(normal), before);
});

test("request, events, plan collections, and metadata are immutable", () => {
    const plan = engine().plan(buildScore({ parts: [{ measures: [{ voices: [[note("n", "C4")]] }] }] }));
    assert.ok(plan.request instanceof PlaybackRequest);
    assert.ok(plan.events[0] instanceof PlaybackEvent);
    assert.equal(Object.isFrozen(plan.request), true);
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.events), true);
    assert.equal(Object.isFrozen(plan.metadata), true);
    assert.throws(() => { plan.events.push("x"); }, TypeError);
    assert.throws(() => { plan.metadata.strategyId = "changed"; }, TypeError);
});

test("PlaybackEngine validates input, options, selection, and output contracts", () => {
    const graph = buildScore({ parts: [{ measures: [{ voices: [[note("n", "C4")]] }] }] });
    assert.throws(() => new PlaybackEngine().plan(graph), /No playback strategy/);
    assert.throws(() => engine().plan({}), /requires a ScoreGraph/);
    assert.throws(() => engine().plan(graph, []), /options must be an object/);
    assert.throws(() => engine().plan(graph, { unknown: true }), /Unknown playback option/);
    assert.throws(() => engine().plan(graph, { pluginId: "missing", strategyId: "score" }), /was not found/);
    class Broken extends PlaybackStrategy {
        constructor() { super({ id: "broken", pluginId: "broken" }); }
        supports() { return true; }
        plan() { return {}; }
    }
    const registry = new PlaybackStrategyRegistry();
    registry.register("broken", new Broken());
    assert.throws(() => new PlaybackEngine(registry).plan(graph), /did not return a PlaybackPlan/);
    class Mismatched extends PlaybackStrategy {
        constructor() { super({ id: "mismatch", pluginId: "mismatch" }); }
        supports() { return true; }
        plan() {
            return new PlaybackPlan({
                request: new PlaybackRequest({ tempo: 60 }), resolution: 1, totalTicks: 0,
                metadata: { pluginId: "mismatch", strategyId: "mismatch" }
            });
        }
    }
    const mismatchRegistry = new PlaybackStrategyRegistry();
    mismatchRegistry.register("mismatch", new Mismatched());
    assert.throws(() => new PlaybackEngine(mismatchRegistry).plan(graph), /different request/);
});

test("playback strategies are plugin-isolated and selected deterministically", () => {
    class Marker extends PlaybackStrategy {
        constructor(pluginId) { super({ id: "shared", pluginId }); }
        supports() { return true; }
        plan(score, request) { return new PlaybackPlan({ request, resolution: 1, totalTicks: 0, metadata: { pluginId: String(this.pluginId), strategyId: String(this.id) } }); }
    }
    const graph = buildScore();
    const registry = new PlaybackStrategyRegistry();
    const first = new Marker("plugin.first");
    const second = new Marker("plugin.second");
    registry.register(first.pluginId, first);
    registry.register(second.pluginId, second);
    const playback = new PlaybackEngine(registry);
    assert.equal(playback.plan(graph).metadata.pluginId, "plugin.first");
    assert.equal(playback.plan(graph, { pluginId: "plugin.second" }).metadata.pluginId, "plugin.second");
    assert.equal(playback.plan(graph, { pluginId: "plugin.second", strategyId: "shared" }).metadata.pluginId, "plugin.second");
    assert.throws(() => registry.register("plugin.second", first), /belongs to plugin/);
    assert.throws(() => registry.register("plugin.first", first), /already registered/);
    const replacement = new Marker("plugin.first");
    registry.register("plugin.first", replacement, { replace: true });
    assert.strictEqual(registry.get("plugin.first", "shared"), replacement);
    assert.equal(registry.unregister("plugin.first", "shared"), true);
    assert.equal(registry.unregisterPlugin("plugin.second"), 1);
});

test("PlaybackModule integrates all services and descriptors with Kernel", async () => {
    const kernel = new Kernel();
    const module = new PlaybackModule();
    kernel.use(module);
    await kernel.start();
    assert.strictEqual(kernel.services.resolve("playback.engine"), module.engine);
    assert.strictEqual(kernel.services.resolve("playback.strategyRegistry"), module.strategyRegistry);
    assert.strictEqual(kernel.registries.services.resolve("playback.engine"), module.engine);
    assert.strictEqual(kernel.registries.services.resolve("playback.strategy-registry"), module.strategyRegistry);
    assert.equal(kernel.registries.plugins.has("core.playback.score"), true);
    assert.strictEqual(kernel.registries.playbacks.resolve("playback.score"), module.scoreStrategy);
    assert.equal(kernel.registries.renderers.has("playback.score"), false);
    await kernel.dispose();
    assert.equal(kernel.registries.playbacks.size, 0);
});

test("PlaybackDescriptor routes through Kernel and PlaybackRegistry accepts only playback descriptors", async () => {
    const descriptor = new PlaybackDescriptor({
        id: "playback.test", plugin: { id: "plugin.test", kind: "plugin" },
        capabilities: ["playback-planning"],
        inputTypes: [{ id: "notation.score-graph", kind: "value" }],
        outputTypes: [{ id: "playback.plan", kind: "value" }]
    });
    const kernel = new Kernel();
    const module = { id: "playback.test.module", descriptor };
    kernel.use(module);
    assert.strictEqual(kernel.registries.playbacks.resolve("playback.test"), module);
    assert.equal(kernel.registries.renderers.size, 0);
    assert.throws(() => kernel.registries.playbacks.register(playbackServiceDescriptors.engine), /accepts descriptor types/);
    await kernel.dispose();
    assert.equal(kernel.registries.playbacks.size, 0);
});

test("PlaybackModule rolls back and preserves pre-existing values at every collision point", () => {
    const points = ["engine-service", "registry-service", "engine-descriptor", "registry-descriptor", "plugin", "strategy"];
    for (const point of points) {
        const kernel = new Kernel();
        const existing = { point };
        if (point === "engine-service") kernel.services.register("playback.engine", existing);
        if (point === "registry-service") kernel.services.register("playback.strategyRegistry", existing);
        if (point === "engine-descriptor") kernel.registries.services.register(playbackServiceDescriptors.engine, { value: existing });
        if (point === "registry-descriptor") kernel.registries.services.register(playbackServiceDescriptors.strategies, { value: existing });
        if (point === "plugin") kernel.registries.plugins.register(defaultPlaybackPluginDescriptor, { value: existing });
        if (point === "strategy") kernel.registries.playbacks.register(playbackStrategyDescriptors.score, { value: existing });
        const module = new PlaybackModule();
        assert.throws(() => module.configure(kernel));
        assert.strictEqual(kernel.services.resolve("playback.engine", { optional: true }), point === "engine-service" ? existing : null);
        assert.strictEqual(kernel.services.resolve("playback.strategyRegistry", { optional: true }), point === "registry-service" ? existing : null);
        assert.strictEqual(kernel.registries.services.resolve("playback.engine"), point === "engine-descriptor" ? existing : null);
        assert.strictEqual(kernel.registries.services.resolve("playback.strategy-registry"), point === "registry-descriptor" ? existing : null);
        assert.strictEqual(kernel.registries.plugins.resolve("core.playback.score"), point === "plugin" ? existing : null);
        assert.strictEqual(kernel.registries.playbacks.resolve("playback.score"), point === "strategy" ? existing : null);
        assert.equal(kernel.registries.renderers.size, 0);
    }
});

test("PlaybackModule preserves same-object collisions and rolls back earlier steps", () => {
    const points = ["engine-service", "registry-service", "engine-descriptor", "registry-descriptor", "plugin", "strategy"];
    for (const point of points) {
        const kernel = new Kernel();
        const module = new PlaybackModule();
        if (point === "engine-service") kernel.services.register("playback.engine", module.engine);
        if (point === "registry-service") kernel.services.register("playback.strategyRegistry", module.strategyRegistry);
        if (point === "engine-descriptor") kernel.registries.services.register(playbackServiceDescriptors.engine, { value: module.engine });
        if (point === "registry-descriptor") kernel.registries.services.register(playbackServiceDescriptors.strategies, { value: module.strategyRegistry });
        if (point === "plugin") kernel.registries.plugins.register(defaultPlaybackPluginDescriptor, { value: module.plugin });
        if (point === "strategy") kernel.registries.playbacks.register(playbackStrategyDescriptors.score, { value: module.scoreStrategy });
        assert.throws(() => module.configure(kernel));
        assert.strictEqual(kernel.services.resolve("playback.engine", { optional: true }), point === "engine-service" ? module.engine : null);
        assert.strictEqual(kernel.services.resolve("playback.strategyRegistry", { optional: true }), point === "registry-service" ? module.strategyRegistry : null);
        assert.strictEqual(kernel.registries.services.resolve("playback.engine"), point === "engine-descriptor" ? module.engine : null);
        assert.strictEqual(kernel.registries.services.resolve("playback.strategy-registry"), point === "registry-descriptor" ? module.strategyRegistry : null);
        assert.strictEqual(kernel.registries.plugins.resolve("core.playback.score"), point === "plugin" ? module.plugin : null);
        assert.strictEqual(kernel.registries.playbacks.resolve("playback.score"), point === "strategy" ? module.scoreStrategy : null);
        assert.equal(kernel.registries.renderers.size, 0);
    }
});

test("PlaybackModule removes listener-failed playback insertion and rolls back prior registrations", () => {
    const kernel = new Kernel();
    const module = new PlaybackModule();
    const unsubscribe = kernel.registries.playbacks.subscribe(() => { throw new Error("listener failed"); });
    assert.throws(() => module.configure(kernel), /listener failed/);
    unsubscribe();
    assert.equal(kernel.services.resolve("playback.engine", { optional: true }), null);
    assert.equal(kernel.services.resolve("playback.strategyRegistry", { optional: true }), null);
    assert.equal(kernel.registries.services.has("playback.engine"), false);
    assert.equal(kernel.registries.plugins.has("core.playback.score"), false);
    assert.equal(kernel.registries.playbacks.has("playback.score"), false);
    assert.equal(kernel.registries.renderers.size, 0);
});

test("PlaybackModule configure/dispose is reusable, idempotent, and preserves replacements", () => {
    const kernel = new Kernel();
    const module = new PlaybackModule();
    module.configure(kernel);
    module.configure(kernel);
    const replacementService = {};
    const replacementStrategyService = {};
    const replacementRegistry = {};
    const replacementStrategyRegistry = {};
    const replacementPlugin = {};
    const replacementStrategy = {};
    kernel.services.register("playback.engine", replacementService, { replace: true });
    kernel.services.register("playback.strategyRegistry", replacementStrategyService, { replace: true });
    kernel.registries.services.register(playbackServiceDescriptors.engine, { value: replacementRegistry, replace: true });
    kernel.registries.services.register(playbackServiceDescriptors.strategies, { value: replacementStrategyRegistry, replace: true });
    kernel.registries.plugins.register(defaultPlaybackPluginDescriptor, { value: replacementPlugin, replace: true });
    kernel.registries.playbacks.register(playbackStrategyDescriptors.score, { value: replacementStrategy, replace: true });
    module.dispose();
    module.dispose();
    assert.strictEqual(kernel.services.resolve("playback.engine"), replacementService);
    assert.strictEqual(kernel.services.resolve("playback.strategyRegistry"), replacementStrategyService);
    assert.strictEqual(kernel.registries.services.resolve("playback.engine"), replacementRegistry);
    assert.strictEqual(kernel.registries.services.resolve("playback.strategy-registry"), replacementStrategyRegistry);
    assert.strictEqual(kernel.registries.plugins.resolve("core.playback.score"), replacementPlugin);
    assert.strictEqual(kernel.registries.playbacks.resolve("playback.score"), replacementStrategy);
    assert.equal(kernel.registries.renderers.size, 0);
    kernel.services.unregister("playback.engine");
    kernel.services.unregister("playback.strategyRegistry");
    kernel.registries.services.unregister("playback.engine");
    kernel.registries.services.unregister("playback.strategy-registry");
    kernel.registries.plugins.unregister("core.playback.score");
    kernel.registries.playbacks.unregister("playback.score");
    module.configure(kernel);
    assert.strictEqual(kernel.services.resolve("playback.engine"), module.engine);
    module.dispose();
});

test("Playback public namespace and descriptors expose only planning contracts", () => {
    assert.equal(Playback.PlaybackEngine, PlaybackEngine);
    assert.equal(Playback.ScorePlaybackPlanner, ScorePlaybackPlanner);
    assert.equal(Playback.PlaybackDescriptor, PlaybackDescriptor);
    assert.equal(Playback.PlaybackRegistry, PlaybackRegistry);
    assert.equal(Foundation.PlaybackDescriptor, PlaybackDescriptor);
    assert.equal(Registries.PlaybackRegistry, PlaybackRegistry);
    assert.ok(new Kernel().registries.playbacks instanceof PlaybackRegistry);
    assert.ok(playbackStrategyDescriptors.score instanceof PlaybackDescriptor);
    assert.equal(playbackStrategyDescriptors.score.descriptorType, "playback");
    assert.equal(String(playbackStrategyDescriptors.score.plugin.id), "core.playback.score");
    assert.deepEqual(playbackStrategyDescriptors.score.inputTypes.values.map(String), ["notation.score-graph"]);
    assert.deepEqual(playbackStrategyDescriptors.score.outputTypes.values.map(String), ["playback.plan"]);
    assert.equal(defaultPlaybackPluginDescriptor.extensionPoints.values[0].kind.toString(), "playback");
    assert.equal(String(playbackPackageDescriptor.id), "core.playback");
    assert.equal(String(playbackPackageDescriptor.version), "7.3.0");
    assert.equal(Object.isFrozen(Playback), true);
    for (const excluded of ["AudioContext", "MIDI", "timer", "React", "play"]) assert.equal(excluded in Playback, false);
});
