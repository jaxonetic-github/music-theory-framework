import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordCatalog,
    ChordGenerator,
    ChordPattern,
    GenerationResult,
    Interval,
    Kernel,
    Note,
    PitchClass,
    ReferenceKind,
    ScaleCatalog,
    ScaleGenerator,
    ScalePattern,
    Theory,
    TheoryEdge,
    TheoryGraph,
    TheoryModule,
    TheoryNode,
    TraversalOrder,
    theoryGeneratorDescriptors,
    theoryPackageDescriptor
} from "../src/core/index.js";

test("pitch classes parse accidentals, transpose, and compare enharmonically", () => {
    const sharp = new PitchClass("C#");
    const flat = new PitchClass("Db");
    assert.equal(sharp.semitones, 1);
    assert.equal(String(flat), "Db");
    assert.ok(sharp.enharmonicEquals(flat));
    assert.equal(String(flat.transpose(2)), "Eb");
    assert.equal(String(new PitchClass(10, { prefer: "flats" })), "Bb");
    assert.throws(() => new PitchClass("H"), /Invalid pitch class/);
});

test("intervals support named and compound semitone arithmetic", () => {
    assert.equal(new Interval("M3").semitones, 4);
    assert.equal(new Interval("P5").add("P8").semitones, 19);
    assert.throws(() => new Interval(-1), /Invalid interval/);
});

test("notes convert MIDI, transpose across octaves, and calculate frequency", () => {
    const a4 = new Note("A4");
    assert.equal(a4.midi, 69);
    assert.equal(a4.frequency(), 440);
    assert.equal(String(new Note("B3").transpose(1)), "C4");
    assert.equal(String(Note.fromMidi(60)), "C4");
    assert.equal(new Note("Cb4").midi, 59);
    assert.equal(new Note("B#3").midi, 60);
    assert.equal(String(new Note("Cb4")), "Cb4");
    assert.equal(String(new Note("B#3")), "B#3");
    assert.throws(() => Note.fromMidi(128), /Invalid MIDI note/);
});

test("scale and chord patterns enforce normalized interval structures", () => {
    const scale = new ScalePattern({ id: "custom-scale", intervals: [0, 2, 5, 7] });
    const chord = new ChordPattern({ id: "custom-chord", intervals: [0, 4, 7, 14] });
    assert.deepEqual(scale.intervals, [0, 2, 5, 7]);
    assert.deepEqual(chord.intervals, [0, 4, 7, 14]);
    assert.throws(() => new ScalePattern({ id: "bad", intervals: [0, 4, 4] }), /unique ascending/);
    assert.throws(() => new ChordPattern({ id: "bad", intervals: [4, 7] }), /beginning with 0/);
    assert.throws(() => scale.intervals.push(9), TypeError);
});

test("default catalogs expose modes and chord qualities with duplicate protection", () => {
    const scales = new ScaleCatalog();
    const chords = new ChordCatalog();
    assert.equal(scales.size, 13);
    assert.equal(chords.size, 11);
    assert.equal(scales.get("dorian", { required: true }).name, "Dorian");
    assert.equal(chords.get("dominant-7", { required: true }).symbol, "7");
    assert.throws(() => scales.add(scales.get("major")), /already in the catalog/);
    assert.throws(() => chords.get("unknown", { required: true }), /was not found/);
});

test("scale generator creates pitch collections and octave-aware notes", () => {
    const generator = new ScaleGenerator();
    const scale = generator.generate("C", "major");
    assert.deepEqual(scale.pitchClasses.map(String), ["C", "D", "E", "F", "G", "A", "B"]);
    assert.equal(String(scale.degree(3)), "E");
    assert.equal(scale.degree(8), null);
    assert.ok(scale.contains("B#"));
    assert.deepEqual(generator.generateNotes("B", "major-pentatonic", 3).map(String), ["B3", "C#4", "D#4", "F#4", "G#4"]);
    assert.equal(generator.build({ root: "D", pattern: "dorian" }).pattern.id.toString(), "dorian");
});

test("generators retain explicit flat spelling preference", () => {
    const scale = new ScaleGenerator().generate("F", "major", { prefer: "flats" });
    const chord = new ChordGenerator().generate("Bb", "dominant-7", { prefer: "flats" });
    assert.deepEqual(scale.pitchClasses.map(String), ["F", "G", "A", "Bb", "C", "D", "E"]);
    assert.deepEqual(chord.pitchClasses.map(String), ["Bb", "D", "F", "Ab"]);
    assert.equal(String(chord), "Bb7");
});

test("chord generator creates extended chords and pitched voicings", () => {
    const generator = new ChordGenerator();
    const chord = generator.generate("C", "major-7");
    assert.deepEqual(chord.pitchClasses.map(String), ["C", "E", "G", "B"]);
    assert.ok(chord.contains("Cb"));
    assert.deepEqual(generator.generateNotes("B", "major", 3).map(String), ["B3", "D#4", "F#4"]);
});

test("theory descriptors support value references and publish a stable package contract", () => {
    assert.equal(ReferenceKind.from("value").toString(), "value");
    assert.equal(theoryGeneratorDescriptors.scale.inputTypes.values[0].kind.toString(), "value");
    assert.equal(String(theoryPackageDescriptor.id), "core.theory");
    assert.ok(Theory.ScaleGenerator);
    assert.ok(Object.isFrozen(Theory));
});

test("TheoryModule integrates catalogs and generators with Kernel registries", async () => {
    const kernel = new Kernel().use(new TheoryModule());
    await kernel.start();

    const scales = kernel.context.resolve("theory.scaleGenerator");
    assert.deepEqual(scales.generate("A", "natural-minor").pitchClasses.map(String), ["A", "B", "C", "D", "E", "F", "G"]);
    assert.equal(kernel.registries.packages.resolve("core.theory").id, "core.theory");
    assert.equal(kernel.registries.generators.resolve("theory.scale-generator"), scales);
    assert.equal(kernel.registries.generators.resolve("theory.chord-generator"), kernel.context.resolve("theory.chordGenerator"));
    assert.ok(kernel.registries.services.has("theory.scale-catalog"));

    await kernel.dispose();
    assert.equal(kernel.services.has("theory.scaleGenerator"), false);
    assert.equal(kernel.registries.generators.size, 0);
});

test("theory graphs deeply freeze their nodes, edges, and collections", () => {
    const graph = new TheoryGraph({
        nodes: [{ id: "a", type: "pitch-class", value: new PitchClass("C") }],
        edges: []
    });
    assert.ok(Object.isFrozen(graph));
    assert.ok(Object.isFrozen(graph.nodes));
    assert.ok(Object.isFrozen(graph.nodes[0]));
    assert.ok(graph.nodes[0] instanceof TheoryNode);
    assert.throws(() => graph.nodes.push(new TheoryNode({ id: "b", type: "pitch-class" })), TypeError);
    assert.throws(() => { graph.nodes[0].type = "chord"; }, TypeError);
});

test("theory graphs reject edges whose endpoints do not exist", () => {
    assert.throws(() => new TheoryGraph({
        nodes: [{ id: "a", type: "pitch-class" }],
        edges: [{ id: "missing-target", from: "a", to: "b", type: "related-to" }]
    }), /references a missing node/);
});

test("theory graphs reject duplicate node identifiers", () => {
    assert.throws(() => new TheoryGraph({
        nodes: [
            { id: "duplicate", type: "scale" },
            { id: "duplicate", type: "chord" }
        ]
    }), /Duplicate theory node id/);
});

test("theory graph traversal is deterministic for breadth-first and depth-first orders", () => {
    const graph = new TheoryGraph({
        nodes: ["a", "b", "c", "d"].map(id => ({ id, type: "test-node" })),
        edges: [
            new TheoryEdge({ from: "a", to: "b", type: "next" }),
            new TheoryEdge({ from: "a", to: "c", type: "next" }),
            new TheoryEdge({ from: "b", to: "d", type: "next" }),
            new TheoryEdge({ from: "c", to: "d", type: "next" })
        ]
    });
    assert.deepEqual(graph.traverse("a").map(String), ["a", "b", "c", "d"]);
    assert.deepEqual(graph.traverse("a", { order: TraversalOrder.DEPTH_FIRST }).map(String), ["a", "b", "d", "c"]);
    assert.deepEqual(graph.traverse("a").map(String), ["a", "b", "c", "d"]);
});

test("repeated generation produces identical domain models and graph traversal", () => {
    const generator = new ScaleGenerator();
    const first = generator.generateResult("Eb", "dorian", { prefer: "flats" });
    const second = generator.generateResult("Eb", "dorian", { prefer: "flats" });
    assert.ok(first.equals(second));
    assert.deepEqual(first.graph.traverse("output:scale").map(String), second.graph.traverse("output:scale").map(String));
    assert.deepEqual(first.model.pitchClasses.map(String), second.model.pitchClasses.map(String));
});

test("scale and chord generators share one immutable generation result contract", () => {
    const scales = new ScaleGenerator();
    const chords = new ChordGenerator();
    const scaleResult = scales.generateResult("C", "major");
    const chordResult = chords.generateResult("C", "major-7");

    assert.ok(scaleResult instanceof GenerationResult);
    assert.ok(chordResult instanceof GenerationResult);
    assert.ok(scaleResult.graph instanceof TheoryGraph);
    assert.equal(scaleResult.model.toString(), scales.generate("C", "major").toString());
    assert.equal(chordResult.model.toString(), chords.generate("C", "major-7").toString());
    assert.equal(String(scaleResult.generatorId), "theory.scale-generator");
    assert.ok(Object.isFrozen(scaleResult));
    assert.ok(Object.isFrozen(scaleResult.graph));
});
