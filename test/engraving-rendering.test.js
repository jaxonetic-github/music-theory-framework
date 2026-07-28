import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordNode, Clef, KeySignature, MeasureNode, NoteNode, PartNode, RendererStrategyRegistry,
    RenderingEngine, RestNode, ScoreEdge, ScoreGraph, ScoreRootNode, SvgScoreRenderer, VoiceNode
} from "../src/core/index.js";

const duration = (numerator, denominator) => ({ numerator, denominator });
function graph({ clef = "treble", key = null, meter = [4, 4], measures = [[
    new NoteNode({ id: "note:1", pitch: "D4", duration: duration(1, 4), offset: 0 })
]], secondPart = false, reverse = false } = {}) {
    const root = new ScoreRootNode({ id: "engraving-score", title: "Engraving fixture" });
    const parts = [new PartNode({ id: "part:1", name: "Piano", clef: new Clef(clef) })];
    if (secondPart) parts.push(new PartNode({ id: "part:2", name: "Second staff", clef: new Clef("bass") }));
    const nodes = [root, ...parts], edges = parts.map(part => new ScoreEdge({ from: root.id, to: part.id, type: "contains" }));
    for (const [partIndex, part] of parts.entries()) {
        for (const [measureIndex, sourceEvents] of measures.entries()) {
            const measure = new MeasureNode({ id: `measure:${partIndex+1}:${measureIndex+1}`, number: measureIndex + 1, beats: meter[0], beatUnit: meter[1], keySignature: key ? new KeySignature(key) : null });
            const voice = new VoiceNode({ id: `voice:${partIndex+1}:${measureIndex+1}`, index: 1 });
            nodes.push(measure, voice);
            edges.push(new ScoreEdge({ from: part.id, to: measure.id, type: "contains" }), new ScoreEdge({ from: measure.id, to: voice.id, type: "contains" }));
            const values = partIndex === 0 ? sourceEvents : [new NoteNode({ id: `part2-note:${measureIndex+1}`, pitch: "C3", duration: duration(1, 2), offset: 0 })];
            values.forEach((event, index) => {
                nodes.push(event); edges.push(new ScoreEdge({ from: voice.id, to: event.id, type: "contains" }));
                if (index) edges.push(new ScoreEdge({ from: values[index-1].id, to: event.id, type: "next" }));
            });
        }
    }
    return new ScoreGraph({ nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges });
}
function render(score, options = {}) {
    const registry = new RendererStrategyRegistry(), strategy = new SvgScoreRenderer();
    registry.register(strategy.pluginId, strategy);
    return new RenderingEngine(registry).render(score, options);
}
function group(svg, id) {
    const start = svg.indexOf(`data-node-id="${id}"`);
    assert.notEqual(start, -1);
    const from = svg.lastIndexOf("<g", start), next = svg.indexOf('<g class="event ', start + 1);
    return svg.slice(from, next < 0 ? svg.length : next);
}
function eventAttribute(svg, id, name) {
    return new RegExp(`${name}="([^"]+)"`).exec(group(svg, id))?.[1];
}

test("quarter-note fixture is conventional five-line staff notation without diagnostic painting", () => {
    const svg = render(graph());
    assert.equal((svg.match(/class="staff-line"/g) ?? []).length, 5);
    assert.match(svg, /class="clef clef-treble"/);
    assert.match(svg, /class="time-signature"/);
    assert.match(svg, /class="notehead"/);
    assert.match(svg, /class="stem stem-/);
    assert.match(svg, /class="barline"/);
    assert.doesNotMatch(svg, /<rect[^>]*class="measure|>treble clef<|>no key signature<|>D4</);
    assert.match(svg, /aria-label="1\/4 note D4"/);
    assert.match(svg, /data-pitch="D4"/);
});

test("all accepted clefs use deterministic renderer-owned vector glyphs", () => {
    for (const clef of ["treble", "bass", "alto", "tenor", "percussion"]) {
        const svg = render(graph({ clef }));
        assert.match(svg, new RegExp(`class="clef clef-${clef}`));
        assert.doesNotMatch(svg, new RegExp(`>${clef} clef<`));
    }
});

test("written diatonic spelling controls pitch position and ledger lines", () => {
    const values = [
        new NoteNode({ id: "cb", pitch: "Cb4", duration: duration(1, 4), offset: 0 }),
        new NoteNode({ id: "bs", pitch: "B#3", duration: duration(1, 4), offset: 1 }),
        new NoteNode({ id: "low", pitch: "C3", duration: duration(1, 4), offset: 2 }),
        new NoteNode({ id: "high", pitch: "C6", duration: duration(1, 4), offset: 3 })
    ];
    const svg = render(graph({ measures: [values] }));
    const y = id => Number(/class="notehead[^"]*" cx="[^"]+" cy="([^"]+)"/.exec(group(svg, id))[1]);
    assert.notEqual(y("cb"), y("bs"));
    assert.equal(Math.abs(y("cb") - y("bs")), 6);
    assert.match(group(svg, "low"), /class="ledger-line"/);
    assert.match(group(svg, "high"), /class="ledger-line"/);
});

test("whole, half, quarter, eighth, and dotted values retain exact duration glyph semantics", () => {
    const values = [
        new NoteNode({ id: "whole", pitch: "D4", duration: duration(1, 1), offset: 0 }),
        new NoteNode({ id: "half", pitch: "E4", duration: duration(1, 2), offset: 1 }),
        new NoteNode({ id: "quarter", pitch: "F#4", duration: duration(1, 4), offset: 2 }),
        new NoteNode({ id: "eighth", pitch: "G4", duration: duration(1, 8), offset: 3 }),
        new NoteNode({ id: "dotted", pitch: "A4", duration: duration(3, 8), offset: 4 })
    ];
    const svg = render(graph({ key: "D", measures: [values] }));
    assert.match(group(svg, "whole"), /notehead open/); assert.doesNotMatch(group(svg, "whole"), /class="stem/);
    assert.match(group(svg, "half"), /notehead open/); assert.match(group(svg, "half"), /class="stem/);
    assert.doesNotMatch(group(svg, "quarter"), /notehead open/); assert.match(group(svg, "quarter"), /class="stem/);
    assert.match(group(svg, "eighth"), /class="flag/);
    assert.match(group(svg, "dotted"), /class="augmentation-dot"/);
    for (const value of ["1/1", "1/2", "1/4", "1/8", "3/8"]) assert.match(svg, new RegExp(`data-duration="${value.replace("/", "\\/")}"`));
});

test("supported rests render conventional duration-specific shapes without pitch labels", () => {
    const values = [
        new RestNode({ id: "rest-whole", duration: duration(1, 1), offset: 0 }),
        new RestNode({ id: "rest-half", duration: duration(1, 2), offset: 1 }),
        new RestNode({ id: "rest-quarter", duration: duration(1, 4), offset: 2 }),
        new RestNode({ id: "rest-eighth", duration: duration(1, 8), offset: 3 })
    ];
    const svg = render(graph({ measures: [values] }));
    for (const kind of ["whole", "half", "quarter", "eighth"]) assert.match(svg, new RegExp(`rest rest-${kind}`));
    assert.doesNotMatch(svg, />rest<|data-pitch=/);
});

test("triads and accidental-heavy sevenths share rhythmic x with readable heads and columns", () => {
    const values = [
        new ChordNode({ id: "triad", notes: ["D4", "F#4", "A4"], duration: duration(1, 4), offset: 0 }),
        new ChordNode({ id: "seventh", notes: ["Cb4", "Eb4", "Gb4", "Bb4"], duration: duration(1, 2), offset: 1 })
    ];
    const svg = render(graph({ measures: [values] }));
    for (const id of ["triad", "seventh"]) {
        const fragment = group(svg, id), centers = [...fragment.matchAll(/class="notehead[^"]*" cx="([^"]+)"/g)].map(match => Number(match[1]));
        assert.ok(centers.length >= 3);
        assert.ok(Math.max(...centers) - Math.min(...centers) <= 9);
        assert.equal((fragment.match(/class="stem /g) ?? []).length, 1);
    }
    const accidentalXs = [...group(svg, "seventh").matchAll(/class="accidental [^"]+"[^>]*d="M(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
    assert.equal(new Set(accidentalXs).size, accidentalXs.length);
});

test("key, meter, continuous measures, wrapping, parts, and deterministic reversal remain structural", () => {
    const measureA = [new NoteNode({ id: "a", pitch: "D4", duration: duration(1, 4), offset: 0 })];
    const measureB = [new NoteNode({ id: "b", pitch: "F#4", duration: duration(1, 4), offset: 0 })];
    const score = graph({ key: "D", measures: [measureA, measureB], secondPart: true });
    const wide = render(score, { width: 1200 }), narrow = render(score, { width: 260 });
    assert.match(wide, /class="key-signature"/);
    assert.match(wide, /aria-label="4 over 4 time"/);
    assert.ok((wide.match(/class="measure"/g) ?? []).length >= 4);
    assert.ok((wide.match(/class="barline/g) ?? []).length >= 6);
    assert.ok((narrow.match(/class="part layout-system"/g) ?? []).length > (wide.match(/class="part layout-system"/g) ?? []).length);
    assert.equal((narrow.match(/class="time-signature"/g) ?? []).length, 2);
    const ys = [...wide.matchAll(/class="staff-line"[^>]*y1="([^"]+)"/g)].map(match => Number(match[1]));
    assert.ok(Math.max(...ys.slice(0, 5)) < Math.min(...ys.slice(5)));
    const reversed = graph({ key: "D", measures: [
        [new NoteNode({ id: "a", pitch: "D4", duration: duration(1, 4), offset: 0 })],
        [new NoteNode({ id: "b", pitch: "F#4", duration: duration(1, 4), offset: 0 })]
    ], secondPart: true, reverse: true });
    assert.equal(render(reversed), wide);
});

test("multiple voices use opposing deterministic stems at one rhythmic position", () => {
    const root = new ScoreRootNode({ id: "two-voice-score", title: "Two voices" });
    const part = new PartNode({ id: "two-voice-part", name: "Piano", clef: new Clef("treble") });
    const measure = new MeasureNode({ id: "two-voice-measure", number: 1, beats: 4, beatUnit: 4 });
    const upper = new VoiceNode({ id: "upper-voice", index: 1 });
    const lower = new VoiceNode({ id: "lower-voice", index: 2 });
    const upperNote = new NoteNode({ id: "upper-note", pitch: "C5", duration: duration(1, 4), offset: 0 });
    const lowerNote = new NoteNode({ id: "lower-note", pitch: "E3", duration: duration(1, 4), offset: 0 });
    const score = new ScoreGraph({
        nodes: [root, part, measure, upper, lower, upperNote, lowerNote],
        edges: [
            new ScoreEdge({ from: root.id, to: part.id, type: "contains" }),
            new ScoreEdge({ from: part.id, to: measure.id, type: "contains" }),
            new ScoreEdge({ from: measure.id, to: upper.id, type: "contains" }),
            new ScoreEdge({ from: measure.id, to: lower.id, type: "contains" }),
            new ScoreEdge({ from: upper.id, to: upperNote.id, type: "contains" }),
            new ScoreEdge({ from: lower.id, to: lowerNote.id, type: "contains" })
        ]
    });
    const svg = render(score);
    assert.equal(eventAttribute(svg, "upper-note", "data-x"), eventAttribute(svg, "lower-note", "data-x"));
    assert.match(group(svg, "upper-note"), /class="stem stem-up"/);
    assert.match(group(svg, "lower-note"), /class="stem stem-down"/);
    assert.equal((svg.match(/class="staff-line"/g) ?? []).length, 5);
});
