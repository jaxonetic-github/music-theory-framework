import test from "node:test";
import assert from "node:assert/strict";

import {
    ChordNode,
    Export,
    ExportEngine,
    ExportModule,
    ExportResult,
    ExporterStrategy,
    ExporterStrategyRegistry,
    Kernel,
    MeasureNode,
    MusicXmlExporter,
    NoteNode,
    PartNode,
    RestNode,
    ScoreEdge,
    ScoreGraph,
    ScoreRootNode,
    VoiceNode,
    defaultExportPluginDescriptor,
    exportExporterDescriptors,
    exportPackageDescriptor,
    exportServiceDescriptors
} from "../src/core/index.js";

function buildScore({
    title = "Export Score",
    part = {},
    measure = {},
    events = [],
    nextEdges = [],
    metadata
} = {}) {
    const nodes = [
        new ScoreRootNode({ id: "score", title, metadata }),
        new PartNode({ id: "part:1", name: "Piano", instrument: "piano", ...part }),
        new MeasureNode({ id: "measure:1", number: 1, ...measure }),
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

function noteEvent(id, pitch, offset, duration = { numerator: 1, denominator: 4 }) {
    return new NoteNode({ id, pitch, offset, duration });
}

function defaultEngine() {
    const registry = new ExporterStrategyRegistry();
    registry.register("core.export.musicxml", new MusicXmlExporter());
    return new ExportEngine(registry);
}

function steps(xml) {
    return [...xml.matchAll(/<step>([A-G])<\/step>/g)].map(match => match[1]);
}

test("ExportResult is immutable and validates its output contract", () => {
    const result = new ExportResult({ format: "MusicXML", mediaType: "APPLICATION/XML", extension: ".musicxml", content: "<score/>" });
    assert.equal(result.format, "musicxml");
    assert.equal(result.mediaType, "application/xml");
    assert.equal(result.extension, "musicxml");
    assert.equal(result.content, "<score/>");
    assert.equal(Object.isFrozen(result), true);
    assert.throws(() => { result.content = "changed"; }, TypeError);
    assert.throws(() => new ExportResult({ format: "x", mediaType: "invalid", extension: "x", content: "x" }), /media type/);
    assert.throws(() => new ExportResult({ format: "x", mediaType: "text/x", extension: "../x", content: "x" }), /extension/);
    assert.throws(() => new ExportResult({ format: "x", mediaType: "text/x", extension: "x", content: "" }), /content/);
});

test("ExportEngine validates input, format, options, selection, and output", () => {
    const graph = buildScore();
    assert.throws(() => new ExportEngine().export(graph, "musicxml"), /No exporter strategy/);
    assert.throws(() => defaultEngine().export({}, "musicxml"), /requires a ScoreGraph/);
    assert.throws(() => defaultEngine().export(graph, ""), /target format/);
    assert.throws(() => defaultEngine().export(graph, "musicxml", []), /options must be an object/);
    assert.throws(() => defaultEngine().export(graph, "svg"), /No exporter strategy/);
    assert.throws(
        () => defaultEngine().export(graph, "svg", { pluginId: "core.export.musicxml", strategyId: "musicxml" }),
        /produces "musicxml", not "svg"/
    );
    assert.throws(
        () => defaultEngine().export(graph, "musicxml", { pluginId: "missing", strategyId: "musicxml" }),
        /was not found/
    );

    class BrokenExporter extends ExporterStrategy {
        constructor() { super({ id: "broken", pluginId: "plugin.broken", format: "broken", mediaType: "text/plain" }); }
        supports() { return true; }
        export() { return "broken"; }
    }
    const registry = new ExporterStrategyRegistry();
    registry.register("plugin.broken", new BrokenExporter());
    assert.throws(() => new ExportEngine(registry).export(graph, "broken"), /did not return an ExportResult/);
});

test("ExportEngine rejects results incompatible with the selected strategy", () => {
    class IncompatibleExporter extends ExporterStrategy {
        constructor() { super({ id: "bad", pluginId: "plugin.bad", format: "alpha", mediaType: "text/alpha" }); }
        supports() { return true; }
        export() { return new ExportResult({ format: "beta", mediaType: "text/beta", extension: "txt", content: "bad" }); }
    }
    const registry = new ExporterStrategyRegistry();
    registry.register("plugin.bad", new IncompatibleExporter());
    assert.throws(() => new ExportEngine(registry).export(buildScore(), "alpha"), /incompatible export result/);
});

test("exporter strategies are plugin-isolated and selected deterministically", () => {
    class MarkerExporter extends ExporterStrategy {
        constructor(pluginId) { super({ id: "shared", pluginId, format: "marker", mediaType: "text/plain" }); }
        supports() { return true; }
        export() { return new ExportResult({ format: this.format, mediaType: this.mediaType, extension: "txt", content: String(this.pluginId) }); }
    }
    const registry = new ExporterStrategyRegistry();
    const first = new MarkerExporter("plugin.first");
    const second = new MarkerExporter("plugin.second");
    const replacement = new MarkerExporter("plugin.first");
    registry.register(first.pluginId, first);
    registry.register(second.pluginId, second);
    const engine = new ExportEngine(registry);

    assert.equal(engine.export(buildScore(), "marker").content, "plugin.first");
    assert.equal(engine.export(buildScore(), "marker", { pluginId: "plugin.second" }).content, "plugin.second");
    assert.equal(engine.export(buildScore(), "marker", { pluginId: "plugin.second", strategyId: "shared" }).content, "plugin.second");
    assert.throws(() => registry.register("plugin.second", first), /belongs to plugin/);
    assert.throws(() => registry.register("plugin.first", first), /already registered/);
    assert.equal(registry.register("plugin.first", replacement, { replace: true }), replacement);
    assert.equal(registry.get("plugin.first", "shared"), replacement);
    assert.equal(registry.unregister("plugin.first", "shared"), true);
    assert.equal(registry.unregisterPlugin("plugin.second"), 1);
});

test("MusicXML exporter produces an exact deterministic standalone snapshot", () => {
    const graph = buildScore({
        title: "Snapshot",
        events: [noteEvent("note:1", "C4", 0)]
    });
    const result = defaultEngine().export(graph, "MUSICXML");
    const expected = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="4.0"><work><work-title>Snapshot</work-title></work><identification><miscellaneous><miscellaneous-field name="score-metadata">{&quot;annotations&quot;:{},&quot;attributes&quot;:{},&quot;documentation&quot;:null,&quot;tags&quot;:[]}</miscellaneous-field></miscellaneous></identification><part-list><score-part id="P1"><part-name>Piano</part-name><score-instrument id="P1-I1"><instrument-name>piano</instrument-name></score-instrument></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note></measure></part></score-partwise>';
    assert.equal(result.content, expected);
    assert.equal(defaultEngine().export(graph, "musicxml").content, expected);
    assert.equal(result.format, "musicxml");
    assert.equal(result.mediaType, "application/vnd.recordare.musicxml+xml");
    assert.equal(result.extension, "musicxml");
});

test("MusicXML exports hierarchy, voices, rests, and chord semantics", () => {
    const chord = new ChordNode({ id: "chord:1", notes: ["C4", "Eb4", "G4"], duration: { numerator: 1, denominator: 2 }, offset: 0 });
    const rest = new RestNode({ id: "rest:1", duration: { numerator: 1, denominator: 4 }, offset: 1 });
    const graph = buildScore({ title: "Hierarchy", events: [chord, rest], nextEdges: [["chord:1", "rest:1"]] });
    const xml = defaultEngine().export(graph, "musicxml").content;

    assert.match(xml, /<score-partwise version="4\.0">/);
    assert.match(xml, /<score-part id="P1">.*<part-name>Piano<\/part-name>/);
    assert.match(xml, /<part id="P1"><measure number="1">/);
    assert.equal((xml.match(/<voice>1<\/voice>/g) ?? []).length, 4);
    assert.equal((xml.match(/<chord\/>/g) ?? []).length, 2);
    assert.match(xml, /<note><rest\/><duration>1<\/duration><voice>1<\/voice><type>quarter<\/type><\/note>/);
});

test("MusicXML exports multiple voices with exact backup durations", () => {
    const voiceOne = new VoiceNode({ id: "voice:1", index: 1 });
    const voiceTwo = new VoiceNode({ id: "voice:2", index: 2 });
    const first = noteEvent("note:1", "C4", 0, { numerator: 1, denominator: 4 });
    const second = noteEvent("note:2", "E4", 0, { numerator: 1, denominator: 2 });
    const graph = new ScoreGraph({
        nodes: [
            new ScoreRootNode({ id: "score", title: "Voices" }),
            new PartNode({ id: "part:1" }),
            new MeasureNode({ id: "measure:1", number: 1 }),
            voiceOne, voiceTwo, first, second
        ],
        edges: [
            new ScoreEdge({ from: "score", to: "part:1", type: "contains" }),
            new ScoreEdge({ from: "part:1", to: "measure:1", type: "contains" }),
            new ScoreEdge({ from: "measure:1", to: voiceOne.id, type: "contains" }),
            new ScoreEdge({ from: "measure:1", to: voiceTwo.id, type: "contains" }),
            new ScoreEdge({ from: voiceOne.id, to: first.id, type: "contains" }),
            new ScoreEdge({ from: voiceTwo.id, to: second.id, type: "contains" })
        ]
    });
    const xml = defaultEngine().export(graph, "musicxml").content;
    assert.match(xml, /<voice>1<\/voice>.*<backup><duration>1<\/duration><\/backup>.*<voice>2<\/voice>/);
});

test("MusicXML calculates exact divisions for standard, dotted, and mixed rational durations", () => {
    const durations = [
        ["whole", { numerator: 1, denominator: 1 }],
        ["half", { numerator: 1, denominator: 2 }],
        ["quarter", { numerator: 1, denominator: 4 }],
        ["eighth", { numerator: 1, denominator: 8 }],
        ["dotted", { numerator: 3, denominator: 8 }],
        ["third", { numerator: 1, denominator: 3 }]
    ];
    const events = durations.map(([id, duration], offset) => noteEvent(id, "C4", offset, duration));
    const xml = defaultEngine().export(buildScore({ events }), "musicxml").content;
    assert.match(xml, /<divisions>6<\/divisions>/);
    assert.deepEqual([...xml.matchAll(/<duration>(\d+)<\/duration>/g)].map(match => Number(match[1])), [24, 12, 6, 3, 9, 8]);
    assert.match(xml, /<duration>9<\/duration><voice>1<\/voice><type>quarter<\/type><dot\/>/);
    assert.match(xml, /<duration>8<\/duration><voice>1<\/voice><\/note>/);
});

test("MusicXML exports clef, key signature, time signature, voice, and measure data", () => {
    const graph = buildScore({
        part: { clef: { type: "bass", line: 4, octaveShift: -1 } },
        measure: { number: 7, beats: 6, beatUnit: 8, keySignature: { tonic: "Cb", mode: "major" } },
        events: [noteEvent("note:1", "Cb3", 0)]
    });
    const xml = defaultEngine().export(graph, "musicxml").content;
    assert.match(xml, /<measure number="7">/);
    assert.match(xml, /<key><fifths>-7<\/fifths><mode>major<\/mode><\/key>/);
    assert.match(xml, /<time><beats>6<\/beats><beat-type>8<\/beat-type><\/time>/);
    assert.match(xml, /<clef><sign>F<\/sign><line>4<\/line><clef-octave-change>-1<\/clef-octave-change><\/clef>/);
    assert.match(xml, /<voice>1<\/voice>/);
});

test("MusicXML preserves natural, flat, sharp, Cb, and B# written pitches", () => {
    const pitches = ["C4", "Eb4", "F#4", "Cb4", "B#3"];
    const graph = buildScore({ events: pitches.map((pitch, offset) => noteEvent(`note:${offset}`, pitch, offset)) });
    const xml = defaultEngine().export(graph, "musicxml").content;
    assert.match(xml, /<pitch><step>C<\/step><octave>4<\/octave><\/pitch>/);
    assert.match(xml, /<pitch><step>E<\/step><alter>-1<\/alter><octave>4<\/octave><\/pitch>.*<accidental>flat<\/accidental>/);
    assert.match(xml, /<pitch><step>F<\/step><alter>1<\/alter><octave>4<\/octave><\/pitch>.*<accidental>sharp<\/accidental>/);
    assert.match(xml, /<pitch><step>C<\/step><alter>-1<\/alter><octave>4<\/octave><\/pitch>/);
    assert.match(xml, /<pitch><step>B<\/step><alter>1<\/alter><octave>3<\/octave><\/pitch>/);
});

test("MusicXML escapes titles, part names, instruments, metadata, and attributes", () => {
    const graph = buildScore({
        title: "Original",
        part: { name: 'Piano & "Voice"', instrument: "keys<grand>" },
        metadata: { attributes: { owner: `Tom & Jerry's` } },
        events: [noteEvent("note:1", "C4", 0)]
    });
    const result = defaultEngine().export(graph, "musicxml", {
        title: `Rock & <Roll> "Score" 'One'`,
        metadataName: `meta & "name"`,
        metadata: { unsafe: `<tag a="1">Tom & Jerry's</tag>` }
    });
    assert.match(result.content, /Rock &amp; &lt;Roll&gt; &quot;Score&quot; &apos;One&apos;/);
    assert.match(result.content, /Piano &amp; &quot;Voice&quot;/);
    assert.match(result.content, /keys&lt;grand&gt;/);
    assert.match(result.content, /name="meta &amp; &quot;name&quot;"/);
    assert.equal(result.content.includes("&lt;tag a=\\&quot;1\\&quot;&gt;Tom &amp; Jerry&apos;s&lt;/tag&gt;"), true);
    assert.equal(result.content.includes("<tag"), false);
});

test("MusicXML topologically interleaves partial and independent next chains", () => {
    const partial = buildScore({
        events: [noteEvent("A", "A4", 0), noteEvent("C", "C4", 2), noteEvent("B", "B4", 1)],
        nextEdges: [["A", "C"]]
    });
    assert.deepEqual(steps(defaultEngine().export(partial, "musicxml").content), ["A", "B", "C"]);

    const independent = buildScore({
        events: [noteEvent("A", "A4", 0), noteEvent("D", "D4", 3), noteEvent("B", "B4", 1), noteEvent("C", "C4", 2)],
        nextEdges: [["A", "D"], ["B", "C"]]
    });
    assert.deepEqual(steps(defaultEngine().export(independent, "musicxml").content), ["A", "B", "C", "D"]);
});

test("MusicXML uses node ID to break equal-offset event ties", () => {
    const graph = buildScore({
        events: [noteEvent("note:z", "G4", 1), noteEvent("note:a", "A4", 1), noteEvent("note:m", "E4", 1)]
    });
    assert.deepEqual(steps(defaultEngine().export(graph, "musicxml").content), ["A", "E", "G"]);
});

test("MusicXML is invariant to reversed node and edge arrays", () => {
    const graph = buildScore({
        events: [noteEvent("A", "A4", 0), noteEvent("D", "D4", 3), noteEvent("B", "B4", 1), noteEvent("C", "C4", 2)],
        nextEdges: [["A", "D"], ["B", "C"]]
    });
    const reversed = new ScoreGraph({ nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() });
    assert.equal(defaultEngine().export(reversed, "musicxml").content, defaultEngine().export(graph, "musicxml").content);
});

test("MusicXML export is deterministic and does not mutate ScoreGraph", () => {
    const graph = buildScore({ events: [noteEvent("note:1", "Eb4", 0)] });
    const before = JSON.stringify(graph);
    const first = defaultEngine().export(graph, "musicxml");
    const second = defaultEngine().export(graph, "musicxml");
    assert.equal(first.content, second.content);
    assert.equal(JSON.stringify(graph), before);
    assert.equal(Object.isFrozen(graph), true);
    assert.equal(Object.isFrozen(graph.nodes), true);
    assert.throws(() => { graph.nodes[0].value.title = "Changed"; }, TypeError);
});

test("MusicXML rejects malformed or internally inconsistent score data", () => {
    assert.throws(() => new ScoreGraph({
        nodes: [new ScoreRootNode({ id: "score" }), noteEvent("orphan", "C4", 0)]
    }), /not contained/);

    const duplicateMeasures = new ScoreGraph({
        nodes: [
            new ScoreRootNode({ id: "score" }),
            new PartNode({ id: "part:1" }),
            new MeasureNode({ id: "measure:a", number: 1 }),
            new MeasureNode({ id: "measure:b", number: 1 })
        ],
        edges: [
            new ScoreEdge({ from: "score", to: "part:1", type: "contains" }),
            new ScoreEdge({ from: "part:1", to: "measure:a", type: "contains" }),
            new ScoreEdge({ from: "part:1", to: "measure:b", type: "contains" })
        ]
    });
    assert.throws(() => defaultEngine().export(duplicateMeasures, "musicxml"), /duplicate measure numbers/);
    assert.throws(
        () => defaultEngine().export(new ScoreGraph({ nodes: [new ScoreRootNode({ id: "score" })] }), "musicxml"),
        /requires at least one part/
    );
    const unsafeDuration = buildScore({
        events: [noteEvent("unsafe", "C4", 0, { numerator: Number.MAX_SAFE_INTEGER + 1, denominator: 1 })]
    });
    assert.throws(() => defaultEngine().export(unsafeDuration, "musicxml"), /supported integer range/);
});

test("ExportModule integrates services, plugin scope, and exporter registry with Kernel", async () => {
    const kernel = new Kernel().use(new ExportModule());
    await kernel.start();
    const engine = kernel.context.resolve("export.engine");
    assert.match(engine.export(buildScore(), "musicxml").content, /^<\?xml/);
    assert.equal(kernel.registries.packages.resolve("core.export").id, "core.export");
    assert.equal(kernel.registries.services.resolve("export.engine"), engine);
    assert.equal(kernel.registries.exporters.resolve("export.musicxml").format, "musicxml");
    assert.ok(kernel.registries.plugins.has("core.export.musicxml"));

    await kernel.dispose();
    await kernel.dispose();
    assert.equal(kernel.services.has("export.engine"), false);
    assert.equal(kernel.registries.exporters.size, 0);
});

test("ExportModule rolls back and preserves pre-existing values at every collision point", () => {
    const cases = [
        { area: "container", id: "export.engine" },
        { area: "container", id: "export.strategyRegistry" },
        { area: "services", descriptor: exportServiceDescriptors.engine },
        { area: "services", descriptor: exportServiceDescriptors.strategies },
        { area: "plugins", descriptor: defaultExportPluginDescriptor },
        { area: "exporters", descriptor: exportExporterDescriptors.musicxml }
    ];
    for (const scenario of cases) {
        const kernel = new Kernel();
        const module = new ExportModule();
        const existing = Object.freeze({ owner: `existing:${scenario.area}` });
        if (scenario.area === "container") kernel.services.register(scenario.id, existing);
        else kernel.registries[scenario.area].register(scenario.descriptor, { value: existing });

        assert.throws(() => module.configure(kernel.context), /already registered|Duplicate registration/);
        if (scenario.area === "container") assert.equal(kernel.services.resolve(scenario.id), existing);
        else assert.equal(kernel.registries[scenario.area].resolve(scenario.descriptor.id), existing);
        for (const id of ["export.engine", "export.strategyRegistry"]) {
            assert.equal(kernel.services.has(id), scenario.area === "container" && scenario.id === id);
        }
        assert.equal(kernel.registries.services.size, scenario.area === "services" ? 1 : 0);
        assert.equal(kernel.registries.plugins.size, scenario.area === "plugins" ? 1 : 0);
        assert.equal(kernel.registries.exporters.size, scenario.area === "exporters" ? 1 : 0);
        module.dispose();
        module.dispose();
    }
});

test("ExportModule preserves same-object registry and service collisions", () => {
    const registryCases = [
        { area: "services", descriptor: exportServiceDescriptors.engine, value: module => module.engine },
        { area: "services", descriptor: exportServiceDescriptors.strategies, value: module => module.strategyRegistry },
        { area: "exporters", descriptor: exportExporterDescriptors.musicxml, value: module => module.musicXmlStrategy }
    ];
    for (const scenario of registryCases) {
        const kernel = new Kernel();
        const module = new ExportModule();
        const value = scenario.value(module);
        const original = kernel.registries[scenario.area].register(scenario.descriptor, { value });
        assert.throws(() => module.configure(kernel.context), /Duplicate registration/);
        assert.equal(kernel.registries[scenario.area].getRecord(scenario.descriptor.id), original);
        assert.equal(kernel.registries[scenario.area].resolve(scenario.descriptor.id), value);
        assert.equal(kernel.services.has("export.engine"), false);
        assert.equal(kernel.services.has("export.strategyRegistry"), false);
    }

    for (const scenario of [
        { id: "export.engine", value: module => module.engine },
        { id: "export.strategyRegistry", value: module => module.strategyRegistry }
    ]) {
        const kernel = new Kernel();
        const module = new ExportModule();
        const value = scenario.value(module);
        kernel.services.register(scenario.id, value);
        assert.throws(() => module.configure(kernel.context), /already registered/);
        assert.equal(kernel.services.resolve(scenario.id), value);
        assert.equal(kernel.registries.services.size, 0);
        assert.equal(kernel.registries.plugins.size, 0);
        assert.equal(kernel.registries.exporters.size, 0);
    }
});

test("ExportModule removes a listener-failed insertion and rolls back earlier registrations", () => {
    const kernel = new Kernel();
    const module = new ExportModule();
    kernel.registries.exporters.subscribe(event => {
        if (event.type === "registered" && String(event.record.id) === "export.musicxml") throw new Error("listener failed");
    });
    assert.throws(() => module.configure(kernel.context), /listener failed/);
    assert.equal(kernel.services.has("export.engine"), false);
    assert.equal(kernel.services.has("export.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);
    assert.equal(kernel.registries.exporters.size, 0);
});

test("ExportModule configure and dispose are reusable, idempotent, and preserve replacements", () => {
    const kernel = new Kernel();
    const module = new ExportModule();
    assert.equal(module.configure(kernel.context), module);
    assert.equal(module.configure(kernel.context), module);
    const replacementEngine = Object.freeze({ owner: "replacement" });
    const replacementExporter = Object.freeze({ owner: "replacement" });
    kernel.services.register("export.engine", replacementEngine, { replace: true });
    kernel.registries.exporters.register(exportExporterDescriptors.musicxml, { value: replacementExporter, replace: true });
    module.dispose();
    module.dispose();
    assert.equal(kernel.services.resolve("export.engine"), replacementEngine);
    assert.equal(kernel.registries.exporters.resolve("export.musicxml"), replacementExporter);
    assert.equal(kernel.services.has("export.strategyRegistry"), false);
    assert.equal(kernel.registries.services.size, 0);
    assert.equal(kernel.registries.plugins.size, 0);

    const reusableKernel = new Kernel();
    const reusableModule = new ExportModule();
    reusableModule.configure(reusableKernel.context);
    reusableModule.dispose();
    assert.equal(reusableModule.configure(reusableKernel.context), reusableModule);
    assert.match(reusableModule.engine.export(buildScore(), "musicxml").content, /^<\?xml/);
    reusableModule.dispose();
});

test("Export public namespace and descriptors expose only the milestone contract", () => {
    assert.ok(Export.ExportResult);
    assert.ok(Export.ExportEngine);
    assert.ok(Export.ExporterStrategy);
    assert.ok(Export.ExporterStrategyRegistry);
    assert.ok(Export.MusicXmlExporter);
    assert.ok(Export.ExportModule);
    assert.equal(Object.isFrozen(Export), true);
    assert.equal(String(exportPackageDescriptor.id), "core.export");
    assert.equal(String(exportServiceDescriptors.engine.id), "export.engine");
    assert.equal(String(defaultExportPluginDescriptor.id), "core.export.musicxml");
    assert.equal(String(exportExporterDescriptors.musicxml.id), "export.musicxml");
    assert.deepEqual(exportExporterDescriptors.musicxml.formats.values.map(format => String(format.id)), ["musicxml"]);
    assert.equal(Export.Download, undefined);
    assert.equal(Export.Playback, undefined);
    assert.equal(Export.Midi, undefined);
});
