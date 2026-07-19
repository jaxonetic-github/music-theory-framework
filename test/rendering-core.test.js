import test from "node:test";
import assert from "node:assert/strict";

import {
    ChordNode,
    Kernel,
    MeasureNode,
    NoteNode,
    PartNode,
    Rendering,
    RenderingEngine,
    RenderingModule,
    RendererStrategy,
    RendererStrategyRegistry,
    RestNode,
    ScoreEdge,
    ScoreGraph,
    ScoreRootNode,
    SvgScoreRenderer,
    VoiceNode,
    defaultRenderingPluginDescriptor,
    renderingPackageDescriptor,
    renderingRendererDescriptors,
    renderingServiceDescriptors
} from "../src/core/index.js";

function scoreOnly(title = "Solo") {
    return new ScoreGraph({ nodes: [new ScoreRootNode({ id: "score", title })] });
}

function richScore() {
    const nodes = [
        new ScoreRootNode({ id: "score", title: "Accidentals & <Order>", metadata: { attributes: { owner: 'A&B "Music"' } } }),
        new PartNode({ id: "part:1", name: 'Piano & "Voice"', instrument: "keys<grand>", clef: { type: "bass", line: 4, octaveShift: -1 } }),
        new MeasureNode({ id: "measure:1", number: 1, beats: 6, beatUnit: 8, keySignature: { tonic: "Cb", mode: "major" } }),
        new VoiceNode({ id: "voice:1", index: 1 }),
        new NoteNode({ id: "note:cb", pitch: "Cb4", duration: { numerator: 1, denominator: 8 }, offset: 2 }),
        new ChordNode({ id: "chord:1", notes: ["Eb4", "F#4", "B#4"], duration: { numerator: 1, denominator: 2 }, offset: 0 }),
        new RestNode({ id: "rest:1", duration: { numerator: 1, denominator: 4 }, offset: 1 }),
        new NoteNode({ id: "note:bs", pitch: "B#3", duration: { numerator: 1, denominator: 8 }, offset: 3 })
    ];
    const edges = [
        new ScoreEdge({ from: "score", to: "part:1", type: "contains" }),
        new ScoreEdge({ from: "part:1", to: "measure:1", type: "contains" }),
        new ScoreEdge({ from: "measure:1", to: "voice:1", type: "contains" }),
        ...["note:cb", "chord:1", "rest:1", "note:bs"].map(id => new ScoreEdge({ from: "voice:1", to: id, type: "contains" })),
        new ScoreEdge({ from: "chord:1", to: "rest:1", type: "next" }),
        new ScoreEdge({ from: "rest:1", to: "note:cb", type: "next" }),
        new ScoreEdge({ from: "note:cb", to: "note:bs", type: "next" })
    ];
    return new ScoreGraph({ nodes, edges });
}

function eventScore(events, nextEdges = []) {
    const nodes = [
        new ScoreRootNode({ id: "score", title: "Event Order" }),
        new PartNode({ id: "part:1", name: "Order", instrument: "piano" }),
        new MeasureNode({ id: "measure:1", number: 1 }),
        new VoiceNode({ id: "voice:1", index: 1 }),
        ...events
    ];
    const edges = [
        new ScoreEdge({ from: "score", to: "part:1", type: "contains" }),
        new ScoreEdge({ from: "part:1", to: "measure:1", type: "contains" }),
        new ScoreEdge({ from: "measure:1", to: "voice:1", type: "contains" }),
        ...events.map(event => new ScoreEdge({ from: "voice:1", to: event.id, type: "contains" })),
        ...nextEdges.map(([from, to]) => new ScoreEdge({ from, to, type: "next" }))
    ];
    return new ScoreGraph({ nodes, edges });
}

function noteEvent(id, offset) {
    return new NoteNode({ id, pitch: "C4", duration: { numerator: 1, denominator: 4 }, offset });
}

function renderedEventIds(graph) {
    return [...defaultEngine().render(graph).matchAll(/class="event [^"]+" data-node-id="([^"]+)"/g)]
        .map(match => match[1]);
}

function defaultEngine() {
    const registry = new RendererStrategyRegistry();
    registry.register("core.rendering.svg", new SvgScoreRenderer());
    return new RenderingEngine(registry);
}

test("RenderingEngine validates score input, options, selection, and renderer output", () => {
    const graph = scoreOnly();
    assert.throws(() => new RenderingEngine().render(graph), /No renderer strategy/);
    assert.throws(() => defaultEngine().render({}), /requires a ScoreGraph/);
    assert.throws(() => defaultEngine().render(graph, []), /options must be an object/);
    assert.throws(
        () => defaultEngine().render(graph, { pluginId: "missing", strategyId: "svg" }),
        /was not found/
    );

    class BrokenRenderer extends RendererStrategy {
        constructor() { super({ id: "broken", pluginId: "plugin.broken", format: "text" }); }
        supports() { return true; }
        render() { return {}; }
    }
    const registry = new RendererStrategyRegistry();
    registry.register("plugin.broken", new BrokenRenderer());
    assert.throws(() => new RenderingEngine(registry).render(graph), /non-empty string output/);
});

test("malformed score graphs are rejected before rendering", () => {
    assert.throws(() => new ScoreGraph({
        nodes: [
            new ScoreRootNode({ id: "score", title: "Malformed" }),
            new NoteNode({ id: "orphan", pitch: "C4", duration: { numerator: 1, denominator: 4 } })
        ]
    }), /not contained by the score hierarchy/);
    assert.throws(() => new ScoreGraph({
        nodes: [new ScoreRootNode({ id: "score", title: "Malformed" })],
        edges: [new ScoreEdge({ from: "score", to: "missing", type: "contains" })]
    }), /references a missing node/);
});

test("renderer strategies are isolated by plugin and selected deterministically", () => {
    class MarkerRenderer extends RendererStrategy {
        constructor(pluginId) { super({ id: "shared", pluginId, format: "text" }); }
        supports() { return true; }
        render() { return String(this.pluginId); }
    }
    const registry = new RendererStrategyRegistry();
    const first = new MarkerRenderer("plugin.first");
    const second = new MarkerRenderer("plugin.second");
    registry.register(first.pluginId, first);
    registry.register(second.pluginId, second);
    const engine = new RenderingEngine(registry);

    assert.equal(engine.render(scoreOnly()), "plugin.first");
    assert.equal(engine.render(scoreOnly(), { pluginId: "plugin.second" }), "plugin.second");
    assert.equal(engine.render(scoreOnly(), { pluginId: "plugin.second", strategyId: "shared" }), "plugin.second");
    assert.equal(registry.strategies("plugin.first")[0], first);
    assert.throws(() => registry.register("plugin.second", first), /belongs to plugin/);
    assert.throws(() => registry.register("plugin.first", first), /already registered/);
});

test("default SVG renderer produces an exact deterministic standalone snapshot", () => {
    const output = defaultEngine().render(scoreOnly());
    const expected = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1200" height="240" viewBox="0 0 1200 240" role="img" aria-labelledby="score-title"><title id="score-title">Solo</title><metadata>{&quot;annotations&quot;:{},&quot;attributes&quot;:{},&quot;documentation&quot;:null,&quot;tags&quot;:[]}</metadata><g class="score" data-node-id="score" data-metadata="{&quot;annotations&quot;:{},&quot;attributes&quot;:{},&quot;documentation&quot;:null,&quot;tags&quot;:[]}"><text class="score-title" x="40" y="35">Solo</text></g></svg>';
    assert.equal(output, expected);
    assert.equal(defaultEngine().render(scoreOnly()), expected);
    assert.equal(output.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), true);
    assert.equal(output.includes("<!DOCTYPE html>"), false);
    assert.throws(() => defaultEngine().render(scoreOnly(), { width: 0 }), /positive finite/);
    assert.throws(() => defaultEngine().render(scoreOnly(), { height: Number.NaN }), /positive finite/);
});

test("SVG renders the complete score hierarchy and notation values", () => {
    const output = defaultEngine().render(richScore());
    for (const className of ["score", "part", "measure", "voice", "note", "rest", "chord"]) {
        assert.match(output, new RegExp(`class="[^"]*${className}`));
    }
    assert.match(output, /data-clef="bass" data-clef-line="4" data-clef-octave-shift="-1"/);
    assert.match(output, /data-key-tonic="Cb" data-key-mode="major" data-key-accidentals="-7"/);
    assert.match(output, /data-beats="6" data-beat-unit="8"/);
    assert.match(output, /bass clef, Cb major, 6\/8/);
    assert.match(output, /data-duration="1\/2"/);
    assert.match(output, /data-duration="1\/4"/);
    assert.match(output, /data-duration="1\/8"/);
    assert.match(output, /data-offset="0"/);
    assert.match(output, /data-offset="1"/);
    assert.match(output, /data-offset="2"/);
});

test("SVG follows explicit event order across chord, rest, and notes", () => {
    const output = defaultEngine().render(richScore());
    const positions = ["chord:1", "rest:1", "note:cb", "note:bs"].map(id => output.indexOf(`data-node-id="${id}"`));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    assert.match(output, /data-node-id="chord:1" data-order="1"/);
    assert.match(output, /data-node-id="rest:1" data-order="2"/);
    assert.match(output, /data-node-id="note:cb" data-order="3"/);
    assert.match(output, /data-node-id="note:bs" data-order="4"/);
});

test("SVG interleaves a disconnected event within a partial next chain by offset", () => {
    const graph = eventScore(
        [noteEvent("A", 0), noteEvent("C", 2), noteEvent("B", 1)],
        [["A", "C"]]
    );
    assert.deepEqual(renderedEventIds(graph), ["A", "B", "C"]);
});

test("SVG topologically interleaves multiple independent next chains", () => {
    const graph = eventScore(
        [noteEvent("A", 0), noteEvent("D", 3), noteEvent("B", 1), noteEvent("C", 2)],
        [["A", "D"], ["B", "C"]]
    );
    assert.deepEqual(renderedEventIds(graph), ["A", "B", "C", "D"]);
});

test("SVG orders equal-offset disconnected events by node ID", () => {
    const graph = eventScore([noteEvent("note:z", 1), noteEvent("note:a", 1), noteEvent("note:m", 1)]);
    assert.deepEqual(renderedEventIds(graph), ["note:a", "note:m", "note:z"]);
});

test("SVG event output is invariant to reversed node and edge arrays", () => {
    const graph = eventScore(
        [noteEvent("A", 0), noteEvent("D", 3), noteEvent("B", 1), noteEvent("C", 2)],
        [["A", "D"], ["B", "C"]]
    );
    const reversed = new ScoreGraph({ nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() });
    assert.deepEqual(renderedEventIds(reversed), renderedEventIds(graph));
    assert.equal(defaultEngine().render(reversed), defaultEngine().render(graph));
});

test("SVG preserves exact flat, sharp, Cb, and B# spellings", () => {
    const output = defaultEngine().render(richScore());
    for (const spelling of ["Cb4", "Eb4", "F#4", "B#4", "B#3"]) assert.equal(output.includes(spelling), true);
    assert.match(output, /data-pitches="Eb4 F#4 B#4"/);
    assert.match(output, /data-pitch="Cb4"/);
    assert.match(output, /data-pitch="B#3"/);
});

test("SVG escapes title, hierarchy values, attributes, and metadata", () => {
    const output = defaultEngine().render(richScore(), {
        title: `Rock & <Roll> "Score" 'One'`,
        metadata: { unsafe: `<tag a="1">Tom & Jerry's</tag>` }
    });
    assert.match(output, /Rock &amp; &lt;Roll&gt; &quot;Score&quot; &apos;One&apos;/);
    assert.match(output, /data-name="Piano &amp; &quot;Voice&quot;"/);
    assert.match(output, /data-instrument="keys&lt;grand&gt;"/);
    assert.equal(output.includes("&lt;tag a=\\&quot;1\\&quot;&gt;Tom &amp; Jerry&apos;s&lt;/tag&gt;"), true);
    assert.equal(output.includes("<tag"), false);
});

test("rendering is deterministic and does not mutate the ScoreGraph", () => {
    const graph = richScore();
    const before = JSON.stringify(graph);
    const first = defaultEngine().render(graph, { width: 900, height: 500 });
    const second = defaultEngine().render(graph, { width: 900, height: 500 });
    assert.equal(first, second);
    assert.equal(JSON.stringify(graph), before);
    assert.equal(Object.isFrozen(graph), true);
    assert.equal(Object.isFrozen(graph.nodes), true);
    assert.throws(() => { graph.nodes[0].value.title = "Changed"; }, TypeError);
});

test("RenderingModule integrates services, plugin scope, and SVG renderer with Kernel", async () => {
    const kernel = new Kernel().use(new RenderingModule());
    await kernel.start();
    const engine = kernel.context.resolve("rendering.engine");
    assert.match(engine.render(scoreOnly()), /^<svg/);
    assert.equal(kernel.registries.packages.resolve("core.rendering").id, "core.rendering");
    assert.equal(kernel.registries.services.resolve("rendering.engine"), engine);
    assert.equal(kernel.registries.renderers.resolve("rendering.svg").format, "svg");
    assert.ok(kernel.registries.plugins.has("core.rendering.svg"));

    await kernel.dispose();
    await kernel.dispose();
    assert.equal(kernel.services.has("rendering.engine"), false);
    assert.equal(kernel.registries.renderers.size, 0);
});

test("RenderingModule rolls back and preserves pre-existing values at every collision point", () => {
    const cases = [
        { area: "container", id: "rendering.engine" },
        { area: "container", id: "rendering.strategyRegistry" },
        { area: "services", descriptor: renderingServiceDescriptors.engine },
        { area: "services", descriptor: renderingServiceDescriptors.strategies },
        { area: "plugins", descriptor: defaultRenderingPluginDescriptor },
        { area: "renderers", descriptor: renderingRendererDescriptors.svg }
    ];
    for (const scenario of cases) {
        const kernel = new Kernel();
        const module = new RenderingModule();
        const existing = Object.freeze({ owner: `existing:${scenario.area}` });
        if (scenario.area === "container") kernel.services.register(scenario.id, existing);
        else kernel.registries[scenario.area].register(scenario.descriptor, { value: existing });

        assert.throws(() => module.configure(kernel.context), /already registered|Duplicate registration/);
        if (scenario.area === "container") assert.equal(kernel.services.resolve(scenario.id), existing);
        else assert.equal(kernel.registries[scenario.area].resolve(scenario.descriptor.id), existing);
        for (const id of ["rendering.engine", "rendering.strategyRegistry"]) {
            assert.equal(kernel.services.has(id), scenario.area === "container" && scenario.id === id);
        }
        assert.equal(kernel.registries.services.size, scenario.area === "services" ? 1 : 0);
        assert.equal(kernel.registries.plugins.size, scenario.area === "plugins" ? 1 : 0);
        assert.equal(kernel.registries.renderers.size, scenario.area === "renderers" ? 1 : 0);
        module.dispose();
        module.dispose();
    }
});

test("RenderingModule preserves same-object registry collisions and rolls back earlier steps", () => {
    const cases = [
        { area: "services", descriptor: renderingServiceDescriptors.engine, value: module => module.engine },
        { area: "services", descriptor: renderingServiceDescriptors.strategies, value: module => module.strategyRegistry },
        { area: "renderers", descriptor: renderingRendererDescriptors.svg, value: module => module.svgStrategy }
    ];
    for (const scenario of cases) {
        const kernel = new Kernel();
        const module = new RenderingModule();
        const value = scenario.value(module);
        const original = kernel.registries[scenario.area].register(scenario.descriptor, { value });

        assert.throws(() => module.configure(kernel.context), /Duplicate registration/);
        assert.equal(kernel.registries[scenario.area].getRecord(scenario.descriptor.id), original);
        assert.equal(kernel.registries[scenario.area].resolve(scenario.descriptor.id), value);
        assert.equal(kernel.services.has("rendering.engine"), false);
        assert.equal(kernel.services.has("rendering.strategyRegistry"), false);
        assert.equal(kernel.registries.services.size, scenario.area === "services" ? 1 : 0);
        assert.equal(kernel.registries.plugins.size, 0);
        assert.equal(kernel.registries.renderers.size, scenario.area === "renderers" ? 1 : 0);
    }
});

test("RenderingModule preserves same-object service-container collisions", () => {
    const cases = [
        { id: "rendering.engine", value: module => module.engine },
        { id: "rendering.strategyRegistry", value: module => module.strategyRegistry }
    ];
    for (const scenario of cases) {
        const kernel = new Kernel();
        const module = new RenderingModule();
        const value = scenario.value(module);
        kernel.services.register(scenario.id, value);

        assert.throws(() => module.configure(kernel.context), /already registered/);
        assert.equal(kernel.services.resolve(scenario.id), value);
        assert.equal(kernel.services.has("rendering.engine"), scenario.id === "rendering.engine");
        assert.equal(kernel.services.has("rendering.strategyRegistry"), scenario.id === "rendering.strategyRegistry");
        assert.equal(kernel.registries.services.size, 0);
        assert.equal(kernel.registries.plugins.size, 0);
        assert.equal(kernel.registries.renderers.size, 0);
    }
});

test("RenderingModule removes a listener-failed insertion and all earlier registrations", () => {
    const kernel = new Kernel();
    const module = new RenderingModule();
    kernel.registries.renderers.subscribe(event => {
        if (event.type === "registered" && String(event.record.id) === "rendering.svg") throw new Error("listener failed");
    });

    assert.throws(() => module.configure(kernel.context), /listener failed/);
    assert.equal(kernel.services.has("rendering.engine"), false);
    assert.equal(kernel.services.has("rendering.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
    assert.equal(kernel.registries.renderers.size, 0);
});

test("RenderingModule configure and dispose are idempotent and preserve replacements", () => {
    const kernel = new Kernel();
    const module = new RenderingModule();
    assert.equal(module.configure(kernel.context), module);
    assert.equal(module.configure(kernel.context), module);
    const replacementEngine = Object.freeze({ owner: "replacement" });
    const replacementRenderer = Object.freeze({ owner: "replacement" });
    kernel.services.register("rendering.engine", replacementEngine, { replace: true });
    kernel.registries.renderers.register(renderingRendererDescriptors.svg, { value: replacementRenderer, replace: true });

    module.dispose();
    module.dispose();
    assert.equal(kernel.services.resolve("rendering.engine"), replacementEngine);
    assert.equal(kernel.registries.renderers.resolve("rendering.svg"), replacementRenderer);
    assert.equal(kernel.services.has("rendering.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);

    const reusableKernel = new Kernel();
    const reusableModule = new RenderingModule();
    reusableModule.configure(reusableKernel.context);
    reusableModule.dispose();
    assert.equal(reusableModule.configure(reusableKernel.context), reusableModule);
    assert.match(reusableModule.engine.render(scoreOnly()), /^<svg/);
    reusableModule.dispose();
});

test("Rendering public namespace and descriptors expose only the v6.5 contract", () => {
    assert.ok(Rendering.RenderingEngine);
    assert.ok(Rendering.RendererStrategyRegistry);
    assert.ok(Rendering.RendererStrategy);
    assert.ok(Rendering.SvgScoreRenderer);
    assert.ok(Rendering.RenderingModule);
    assert.equal(Object.isFrozen(Rendering), true);
    assert.equal(String(renderingPackageDescriptor.id), "core.rendering");
    assert.equal(String(renderingServiceDescriptors.engine.id), "rendering.engine");
    assert.equal(String(defaultRenderingPluginDescriptor.id), "core.rendering.svg");
    assert.equal(String(renderingRendererDescriptors.svg.id), "rendering.svg");
    assert.deepEqual(renderingRendererDescriptors.svg.formats.values.map(format => String(format.id)), ["svg"]);
    assert.equal(Rendering.Exporter, undefined);
    assert.equal(Rendering.Playback, undefined);
});
