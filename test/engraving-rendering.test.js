import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordNode, Clef, KeySignature, LayoutEngine, LayoutProfile, LayoutStrategyRegistry, MeasureNode, NoteNode,
    PartNode, RendererStrategyRegistry, RenderingEngine, RestNode, ScoreEdge, ScoreGraph,
    ScoreGraphLayoutStrategy, ScoreRootNode, SvgScoreRenderer, VoiceNode
} from "../src/core/index.js";
import { accidentalGlyph } from "../src/core/Rendering/strategies/engraving.js";
import { engravingHeader, keySignatureTransition } from "../src/core/Layout/engravingHeaders.js";

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
function layout(score, width = 1200) {
    const registry = new LayoutStrategyRegistry(), strategy = new ScoreGraphLayoutStrategy();
    registry.register(strategy.pluginId, strategy);
    return new LayoutEngine(registry).plan({ score, availableWidth: width });
}
function changingSignatureGraph(specs, reverse = false) {
    const root = new ScoreRootNode({ id: "change-score", title: "Signature changes" });
    const part = new PartNode({ id: "change-part", name: "Piano", clef: new Clef("treble") });
    const nodes = [root, part], edges = [new ScoreEdge({ from: root.id, to: part.id, type: "contains" })];
    specs.forEach((spec, index) => {
        const measure = new MeasureNode({
            id: `change-measure:${index + 1}`, number: index + 1,
            beats: spec.meter?.[0] ?? 4, beatUnit: spec.meter?.[1] ?? 4,
            keySignature: spec.key ? new KeySignature(spec.key) : null
        });
        const voice = new VoiceNode({ id: `change-voice:${index + 1}`, index: 1 });
        nodes.push(measure, voice);
        edges.push(new ScoreEdge({ from: part.id, to: measure.id, type: "contains" }),
            new ScoreEdge({ from: measure.id, to: voice.id, type: "contains" }));
        (spec.events ?? [new NoteNode({ id: `change-note:${index + 1}`, pitch: "C4", duration: duration(1, 4), offset: 0 })])
            .forEach(event => {
                nodes.push(event);
                edges.push(new ScoreEdge({ from: voice.id, to: event.id, type: "contains" }));
            });
    });
    return new ScoreGraph({ nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges });
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
function chordOffsets(svg, id) {
    return Object.fromEntries([...group(svg, id).matchAll(
        /data-written-position="(-?\d+)" data-head-offset="(-?\d+)"/g
    )].map(match => [Number(match[1]), Number(match[2])]));
}
function precedenceGraph(events, nextPairs, reverse = false) {
    const root = new ScoreRootNode({ id: "precedence-score", title: "Precedence fixture" });
    const part = new PartNode({ id: "precedence-part", name: "Piano", clef: new Clef("treble") });
    const measure = new MeasureNode({ id: "precedence-measure", number: 1, beats: 4, beatUnit: 4 });
    const voice = new VoiceNode({ id: "precedence-voice", index: 1 });
    const nodes = [root, part, measure, voice, ...events];
    const edges = [
        new ScoreEdge({ from: root.id, to: part.id, type: "contains" }),
        new ScoreEdge({ from: part.id, to: measure.id, type: "contains" }),
        new ScoreEdge({ from: measure.id, to: voice.id, type: "contains" }),
        ...events.map(event => new ScoreEdge({ from: voice.id, to: event.id, type: "contains" })),
        ...nextPairs.map(([from, to]) => new ScoreEdge({ from, to, type: "next" }))
    ];
    return new ScoreGraph({ nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges });
}
function polyphonicGraph(voiceEvents, { reverse = false, secondPart = false } = {}) {
    const root = new ScoreRootNode({ id: "poly-score", title: "Polyphonic accidental fixture" });
    const part = new PartNode({ id: "poly-part", name: "Piano", clef: new Clef("treble") });
    const measure = new MeasureNode({ id: "poly-measure", number: 1, beats: 4, beatUnit: 4 });
    const voices = voiceEvents.map((_, index) => new VoiceNode({ id: `poly-voice:${index + 1}`, index: index + 1 }));
    const nodes = [root, part, measure, ...voices], edges = [
        new ScoreEdge({ from: root.id, to: part.id, type: "contains" }),
        new ScoreEdge({ from: part.id, to: measure.id, type: "contains" }),
        ...voices.map(voice => new ScoreEdge({ from: measure.id, to: voice.id, type: "contains" }))
    ];
    voiceEvents.forEach((events, voiceIndex) => events.forEach((event, index) => {
        nodes.push(event);
        edges.push(new ScoreEdge({ from: voices[voiceIndex].id, to: event.id, type: "contains" }));
        if (index) edges.push(new ScoreEdge({ from: events[index - 1].id, to: event.id, type: "next" }));
    }));
    if (secondPart) {
        const otherPart = new PartNode({ id: "poly-part:2", name: "Bass", clef: new Clef("bass") });
        const otherMeasure = new MeasureNode({ id: "poly-measure:2", number: 1, beats: 4, beatUnit: 4 });
        const otherVoice = new VoiceNode({ id: "poly-voice:other", index: 1 });
        const otherNote = new NoteNode({ id: "poly-other-c-sharp", pitch: "C#3", duration: duration(1, 4), offset: 0 });
        nodes.push(otherPart, otherMeasure, otherVoice, otherNote);
        edges.push(new ScoreEdge({ from: root.id, to: otherPart.id, type: "contains" }),
            new ScoreEdge({ from: otherPart.id, to: otherMeasure.id, type: "contains" }),
            new ScoreEdge({ from: otherMeasure.id, to: otherVoice.id, type: "contains" }),
            new ScoreEdge({ from: otherVoice.id, to: otherNote.id, type: "contains" }));
    }
    return new ScoreGraph({ nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges });
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

test("RenderingEngine engraves through a legacy custom LayoutProfile", () => {
    const legacy = new LayoutProfile({
        id: "legacy-rendering", eventGap: 24, measurePadding: 24, clefWidth: 48,
        keySignatureWidth: 40, barlineWidth: 14, staffHeight: 110, staffSpacing: 44, systemSpacing: 42
    });
    const score = graph(), plan = layout(score);
    const customPlan = (() => {
        const registry = new LayoutStrategyRegistry(), strategy = new ScoreGraphLayoutStrategy();
        registry.register(strategy.pluginId, strategy);
        return new LayoutEngine(registry).plan({ score, availableWidth: 600, profile: legacy });
    })();
    const svg = render(score, { layoutPlan: customPlan });
    assert.match(svg, /data-layout-profile="legacy-rendering"/);
    assert.match(svg, /class="notehead"/);
    assert.ok(customPlan.bounds.width >= 600);
    assert.ok(plan.placements.length > 0);
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

test("rests render exact base values, hooks, dots, bounds, and accessible duration names", () => {
    const cases = [
        ["whole", 1, 1, 0, 0], ["half", 1, 2, 0, 0], ["quarter", 1, 4, 0, 0],
        ["eighth", 1, 8, 1, 0], ["16th", 1, 16, 2, 0], ["32nd", 1, 32, 3, 0],
        ["dotted-half", 3, 4, 0, 1], ["dotted-quarter", 3, 8, 0, 1],
        ["dotted-eighth", 3, 16, 1, 1], ["double-dotted-quarter", 7, 16, 0, 2],
        ["triple-dotted-quarter", 15, 32, 0, 3], ["dotted-64th", 3, 128, 4, 1]
    ];
    const values = cases.map(([id, numerator, denominator], offset) =>
        new RestNode({ id: `rest-${id}`, duration: duration(numerator, denominator), offset }));
    const score = graph({ measures: [values] }), plan = layout(score, 1800);
    const svg = render(score, { layoutPlan: plan });
    for (const [id, numerator, denominator, flags, dots] of cases) {
        const fragment = group(svg, `rest-${id}`);
        assert.match(fragment, new RegExp(`data-rest-flags="${flags}"`));
        assert.match(fragment, new RegExp(`data-rest-dots="${dots}"`));
        assert.equal((fragment.match(/class="rest-hook"/g) ?? []).length, flags);
        assert.equal((fragment.match(/class="rest-augmentation-dot"/g) ?? []).length, dots);
        assert.match(fragment, new RegExp(`aria-label="${numerator}\\/${denominator} .*rest"`));
        assert.doesNotMatch(fragment, /data-pitch=/);
    }
    assert.notEqual(group(svg, "rest-eighth"), group(svg, "rest-16th"));
    assert.notEqual(group(svg, "rest-16th"), group(svg, "rest-32nd"));
    const placements = plan.systems[0].measures[0].eventPlacements;
    for (let index = 0; index < placements.length - 1; index += 1) {
        assert.ok(placements[index + 1].x >= placements[index].x + placements[index].width);
    }
    const measure = plan.systems[0].measures[0], last = placements.at(-1);
    assert.ok(measure.x + measure.width > last.x + last.width);
    assert.doesNotMatch(svg, />rest</);
});

test("duration classification is exact, normalized, immutable, and supports arbitrary valid rationals", () => {
    const normalized = graph({ measures: [[new RestNode({ id: "normalized", duration: duration(2, 8), offset: 0 })]] });
    const canonical = graph({ measures: [[new RestNode({ id: "normalized", duration: duration(1, 4), offset: 0 })]] });
    assert.equal(render(normalized), render(canonical));
    const responsiveValues = [
        new RestNode({ id: "responsive-eighth", duration: duration(1, 8), offset: 0 }),
        new RestNode({ id: "responsive-16th", duration: duration(1, 16), offset: 1 }),
        new RestNode({ id: "responsive-dotted", duration: duration(3, 16), offset: 2 })
    ];
    const responsive = graph({ measures: [responsiveValues] });
    const reversed = graph({ measures: [[
        new RestNode({ id: "responsive-eighth", duration: duration(1, 8), offset: 0 }),
        new RestNode({ id: "responsive-16th", duration: duration(1, 16), offset: 1 }),
        new RestNode({ id: "responsive-dotted", duration: duration(3, 16), offset: 2 })
    ]], reverse: true });
    assert.equal(render(responsive, { width: 260 }), render(reversed, { width: 260 }));
    assert.equal(render(responsive, { width: 260 }), render(responsive, { width: 260 }));
    const sourceDuration = duration(1, 3), nonBinary = graph({ measures: [[
        new RestNode({ id: "triplet-half-rest", duration: sourceDuration, offset: 0 }),
        new NoteNode({ id: "triplet-eighth", pitch: "D4", duration: duration(1, 12), offset: 1 }),
        new RestNode({ id: "rest-128th", duration: duration(1, 128), offset: 2 })
    ]] });
    const nonBinaryPlan = layout(nonBinary), nonBinarySvg = render(nonBinary, { layoutPlan: nonBinaryPlan });
    assert.match(group(nonBinarySvg, "triplet-half-rest"), /rest-half/);
    assert.match(group(nonBinarySvg, "triplet-half-rest"), /data-duration-ratio="2:3"/);
    assert.match(group(nonBinarySvg, "triplet-eighth"), /class="flag/);
    assert.match(group(nonBinarySvg, "triplet-eighth"), /data-duration-ratio="2:3"/);
    assert.equal((group(nonBinarySvg, "rest-128th").match(/class="rest-hook"/g) ?? []).length, 5);
    assert.ok(nonBinaryPlan.systems[0].measures[0].eventPlacements.every(value => value.width > 0));
    assert.deepEqual(sourceDuration, { numerator: 1, denominator: 3 });
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

test("consecutive-second chord chains alternate head sides by written staff position", () => {
    const cases = [
        ["seconds-2", ["C4", "D4"], { 28: 0, 29: -9 }],
        ["seconds-3", ["C4", "D4", "E4"], { 28: 0, 29: -9, 30: 0 }],
        ["seconds-4", ["C4", "D4", "E4", "F4"], { 28: 0, 29: -9, 30: 0, 31: -9 }],
        ["seconds-separated", ["C4", "D4", "E4", "G4"], { 28: 0, 29: -9, 30: 0, 32: 0 }],
        ["seconds-two-chains", ["C4", "D4", "F4", "G4"], { 28: 0, 29: -9, 31: 0, 32: -9 }],
        ["seconds-cross-octave", ["B4", "C5", "D5"], { 34: 0, 35: 9, 36: 0 }],
        ["seconds-spelled", ["Cb4", "Db4", "Eb4"], { 28: 0, 29: -9, 30: 0 }],
        ["enharmonic-not-adjacent", ["C#4", "Ebb4"], { 28: 0, 30: 0 }]
    ];
    for (const [id, notes, expected] of cases) {
        const chord = new ChordNode({ id, notes, duration: duration(1, 4), offset: 0 });
        assert.deepEqual(chordOffsets(render(graph({ measures: [[chord]] })), id), expected);
    }
});

test("chord displacement is member-order invariant, mirrors with stem direction, and preserves stems", () => {
    const up = new ChordNode({ id: "chain-up", notes: ["C4", "D4", "E4", "F4"], duration: duration(1, 8), offset: 0 });
    const reversed = new ChordNode({ id: "chain-up", notes: ["F4", "E4", "D4", "C4"], duration: duration(1, 8), offset: 0 });
    const down = new ChordNode({ id: "chain-down", notes: ["C5", "D5", "E5", "F5"], duration: duration(3, 8), offset: 0 });
    const upScore = graph({ measures: [[up]] }), before = JSON.stringify(upScore);
    const upSvg = render(upScore), reversedSvg = render(graph({ measures: [[reversed]], reverse: true }));
    assert.deepEqual(chordOffsets(upSvg, "chain-up"), chordOffsets(reversedSvg, "chain-up"));
    assert.deepEqual(chordOffsets(upSvg, "chain-up"), { 28: 0, 29: -9, 30: 0, 31: -9 });
    const downSvg = render(graph({ measures: [[down]] }));
    assert.deepEqual(chordOffsets(downSvg, "chain-down"), { 35: 0, 36: 9, 37: 0, 38: 9 });
    assert.match(group(upSvg, "chain-up"), /class="stem stem-up" x1="[^"]+" x2="[^"]+"/);
    assert.match(group(upSvg, "chain-up"), /class="flag flag-up"/);
    assert.match(group(downSvg, "chain-down"), /class="stem stem-down"/);
    assert.equal((group(downSvg, "chain-down").match(/class="augmentation-dot"/g) ?? []).length, 4);
    assert.equal(JSON.stringify(upScore), before);
});

test("accidental, ledger-line, duration, and Layout bounds contain alternating chord heads", () => {
    const values = [
        new ChordNode({ id: "chain-accidentals", notes: ["C##4", "Db4", "E#4", "Fb4"], duration: duration(1, 2), offset: 0 }),
        new ChordNode({ id: "chain-ledgers", notes: ["A5", "B5", "C6", "D6"], duration: duration(1, 4), offset: 1 }),
        new ChordNode({ id: "chain-dotted", notes: ["Cb4", "Db4", "Eb4"], duration: duration(3, 8), offset: 2 })
    ];
    const score = graph({ measures: [values] }), plan = layout(score), svg = render(score, { layoutPlan: plan });
    const accidental = group(svg, "chain-accidentals"), ledgers = group(svg, "chain-ledgers"), dotted = group(svg, "chain-dotted");
    assert.equal((accidental.match(/class="accidental /g) ?? []).length, 4);
    assert.ok(new Set([...accidental.matchAll(/data-head-offset="(-?\d+)"/g)].map(match => match[1])).size > 1);
    assert.ok((ledgers.match(/class="ledger-line"/g) ?? []).length >= 4);
    assert.equal((dotted.match(/class="augmentation-dot"/g) ?? []).length, 3);
    for (const placement of plan.placements) {
        assert.ok(placement.width >= 18 + 18);
        assert.ok(placement.x - 9 >= plan.systems[0].measures[0].x);
        assert.ok(placement.x + 9 < plan.systems[0].measures[0].x + plan.systems[0].measures[0].width);
    }
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
    assert.equal((narrow.match(/class="time-signature"/g) ?? []).length, (narrow.match(/class="part layout-system"/g) ?? []).length);
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
    const upperNote = new NoteNode({ id: "upper-note", pitch: "C#4", duration: duration(1, 4), offset: 0 });
    const lowerNote = new NoteNode({ id: "lower-note", pitch: "C#4", duration: duration(1, 4), offset: 1 });
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
    assert.equal((svg.match(/class="accidental accidental-sharp"/g) ?? []).length, 2);
    assert.equal((svg.match(/class="staff-line"/g) ?? []).length, 5);
});

test("polyphonic accidental state follows exact rhythmic onset across voices and rests", () => {
    const later = new NoteNode({ id: "poly-later", pitch: "C#4", duration: duration(1, 4), offset: 0 });
    const earlier = new NoteNode({ id: "poly-earlier", pitch: "C#4", duration: duration(1, 4), offset: 100 });
    const score = polyphonicGraph([
        [new RestNode({ id: "poly-rest", duration: duration(1, 4), offset: 99 }), later],
        [earlier]
    ]);
    const plan = layout(score), placements = plan.systems[0].measures[0].eventPlacements;
    assert.deepEqual(placements.map(value => [value.eventId, value.onset]),
        [["poly-earlier", { numerator: 0, denominator: 1 }], ["poly-rest", { numerator: 0, denominator: 1 }], ["poly-later", { numerator: 1, denominator: 4 }]]);
    const svg = render(score, { layoutPlan: plan });
    assert.match(group(svg, "poly-earlier"), /accidental-sharp/);
    assert.doesNotMatch(group(svg, "poly-later"), /class="accidental /);

    const inverse = polyphonicGraph([[earlier], [
        new RestNode({ id: "poly-rest", duration: duration(1, 4), offset: 99 }), later
    ]], { reverse: true });
    const inversePlan = layout(inverse), inverseSvg = render(inverse, { layoutPlan: inversePlan });
    assert.match(group(inverseSvg, "poly-earlier"), /accidental-sharp/);
    assert.doesNotMatch(group(inverseSvg, "poly-later"), /class="accidental /);
});

test("simultaneous polyphonic accidentals evaluate atomically and retain conflicts", () => {
    const matching = polyphonicGraph([
        [new NoteNode({ id: "match-a", pitch: "C#4", duration: duration(1, 4), offset: 9 })],
        [new NoteNode({ id: "match-b", pitch: "C#4", duration: duration(1, 4), offset: 0 })]
    ]);
    const matchingSvg = render(matching, { layoutPlan: layout(matching) });
    assert.match(group(matchingSvg, "match-a"), /accidental-sharp/);
    assert.match(group(matchingSvg, "match-b"), /accidental-sharp/);

    const conflicting = polyphonicGraph([
        [
            new NoteNode({ id: "conflict-sharp", pitch: "C#4", duration: duration(1, 4), offset: 8 }),
            new NoteNode({ id: "after-conflict", pitch: "C#4", duration: duration(1, 4), offset: 0 })
        ],
        [new NoteNode({ id: "conflict-natural", pitch: "C4", duration: duration(1, 2), offset: 0 })]
    ], { reverse: true, secondPart: true });
    const plan = layout(conflicting), svg = render(conflicting, { layoutPlan: plan });
    assert.match(group(svg, "conflict-sharp"), /accidental-sharp/);
    assert.doesNotMatch(group(svg, "conflict-natural"), /class="accidental /);
    assert.match(group(svg, "after-conflict"), /accidental-sharp/);
    assert.match(group(svg, "poly-other-c-sharp"), /accidental-sharp/);
    assert.ok(Object.isFrozen(plan.systems[0].measures[0].eventPlacements[0].onset));
});

test("polyphonic shared onset columns align mixed durations, rests, chords, and glyph widths", () => {
    const score = polyphonicGraph([
        [
            new ChordNode({ id: "column-chord", notes: ["C#4", "D4", "G4"], duration: duration(1, 2), offset: 90 }),
            new RestNode({ id: "column-half-rest", duration: duration(1, 2), offset: 0 })
        ],
        [
            new RestNode({ id: "column-quarter-rest", duration: duration(1, 4), offset: 80 }),
            new NoteNode({ id: "column-quarter-2", pitch: "Eb4", duration: duration(1, 4), offset: 2 }),
            new NoteNode({ id: "column-quarter-3", pitch: "F4", duration: duration(1, 4), offset: 1 }),
            new NoteNode({ id: "column-quarter-4", pitch: "G4", duration: duration(1, 4), offset: 0 })
        ]
    ]);
    const source = score.nodes.map(value => String(value.id)), plan = layout(score);
    const placements = plan.systems[0].measures[0].eventPlacements;
    const at = id => placements.find(value => value.eventId === id);
    assert.equal(at("column-chord").x, at("column-quarter-rest").x);
    assert.equal(at("column-half-rest").x, at("column-quarter-3").x);
    assert.ok(at("column-quarter-2").x > at("column-quarter-rest").x);
    assert.ok(at("column-quarter-3").x > at("column-quarter-2").x);
    assert.ok(at("column-quarter-4").x > at("column-quarter-3").x);
    assert.deepEqual(placements.map(value => value.onset), [
        { numerator: 0, denominator: 1 }, { numerator: 0, denominator: 1 },
        { numerator: 1, denominator: 4 }, { numerator: 1, denominator: 2 },
        { numerator: 1, denominator: 2 }, { numerator: 3, denominator: 4 }
    ]);
    const measure = plan.systems[0].measures[0];
    assert.ok(placements.every(value => value.x >= measure.x && value.x + value.width <= measure.x + measure.width));
    assert.deepEqual(score.nodes.map(value => String(value.id)), source);
});

test("whole, dotted, and reversed chord-member fixtures retain deterministic shared columns", () => {
    const build = notes => polyphonicGraph([
        [new NoteNode({ id: "column-whole", pitch: "C4", duration: duration(1, 1), offset: 40 })],
        [
            new ChordNode({ id: "column-reversible", notes, duration: duration(3, 8), offset: 30 }),
            new NoteNode({ id: "column-dotted-next", pitch: "A4", duration: duration(1, 8), offset: 20 }),
            new NoteNode({ id: "column-halfway", pitch: "B4", duration: duration(1, 2), offset: 10 })
        ]
    ], { reverse: true });
    const first = layout(build(["C#4", "D4", "G4"])), reversed = layout(build(["G4", "D4", "C#4"]));
    const values = first.systems[0].measures[0].eventPlacements;
    assert.equal(values[0].x, values[1].x);
    assert.ok(values[2].x > values[1].x);
    assert.ok(values[3].x > values[2].x);
    assert.equal(first.systems[0].measures[0].naturalWidth, reversed.systems[0].measures[0].naturalWidth);
    assert.deepEqual(values.map(value => [value.eventId, value.x, value.onset]),
        reversed.systems[0].measures[0].eventPlacements.map(value => [value.eventId, value.x, value.onset]));
});

test("all supported written accidentals use explicit glyph mappings", () => {
    const values = ["Cbb4", "Cb4", "C4", "C#4", "C##4"].map((pitch, index) =>
        new NoteNode({ id: `accidental-${index}`, pitch, duration: duration(1, 4), offset: index }));
    const svg = render(graph({ measures: [values] }));
    for (const [index, kind] of ["double-flat", "flat", "natural", "sharp", "double-sharp"].entries()) {
        assert.match(group(svg, `accidental-${index}`), new RegExp(`accidental-${kind}`));
    }
    assert.doesNotMatch(group(svg, "accidental-0"), /accidental-natural/);
    assert.throws(() => accidentalGlyph("triple-sharp", 0, 0), /Unsupported engraving accidental/);
});

test("measure accidental state is keyed by written step and octave and resets", () => {
    const first = [
        new NoteNode({ id: "c-sharp-4", pitch: "C#4", duration: duration(1, 4), offset: 0 }),
        new NoteNode({ id: "c-natural-5", pitch: "C5", duration: duration(1, 4), offset: 1 }),
        new NoteNode({ id: "c-natural-4", pitch: "C4", duration: duration(1, 4), offset: 2 }),
        new NoteNode({ id: "c-sharp-again", pitch: "C#4", duration: duration(1, 4), offset: 3 }),
        new NoteNode({ id: "c-sharp-repeat", pitch: "C#4", duration: duration(1, 4), offset: 4 })
    ];
    const second = [new NoteNode({ id: "c-sharp-next-measure", pitch: "C#4", duration: duration(1, 4), offset: 0 })];
    const svg = render(graph({ measures: [first, second] }));
    assert.match(group(svg, "c-sharp-4"), /accidental-sharp/);
    assert.doesNotMatch(group(svg, "c-natural-5"), /class="accidental /);
    assert.match(group(svg, "c-natural-4"), /accidental-natural/);
    assert.match(group(svg, "c-sharp-again"), /accidental-sharp/);
    assert.doesNotMatch(group(svg, "c-sharp-repeat"), /class="accidental /);
    assert.match(group(svg, "c-sharp-next-measure"), /accidental-sharp/);
});

test("accidentals follow authoritative Layout placement precedence instead of conflicting offsets", () => {
    const events = [
        new NoteNode({ id: "precedence-first", pitch: "C#4", duration: duration(1, 4), offset: 10 }),
        new NoteNode({ id: "precedence-second", pitch: "C#4", duration: duration(1, 4), offset: 0 }),
        new NoteNode({ id: "precedence-cancel", pitch: "C4", duration: duration(1, 4), offset: 1 })
    ];
    const links = [["precedence-first", "precedence-second"], ["precedence-second", "precedence-cancel"]];
    const score = precedenceGraph(events, links), reversed = precedenceGraph(events, links, true);
    const plan = layout(score), reversedPlan = layout(reversed);
    const placements = plan.systems[0].measures[0].eventPlacements;
    assert.deepEqual(placements.map(value => value.eventId), events.map(value => String(value.id)));
    assert.deepEqual(reversedPlan.systems, plan.systems);
    const svg = render(score, { layoutPlan: plan });
    assert.match(group(svg, "precedence-first"), /accidental-sharp/);
    assert.doesNotMatch(group(svg, "precedence-second"), /class="accidental /);
    assert.match(group(svg, "precedence-cancel"), /accidental-natural/);
    assert.ok(svg.indexOf('data-node-id="precedence-first"') < svg.indexOf('data-node-id="precedence-second"'));
    assert.equal(render(reversed, { layoutPlan: reversedPlan }), svg);
});

test("chord accidental decisions are atomic in authoritative placement order", () => {
    const events = [
        new ChordNode({ id: "precedence-chord", notes: ["E4", "C#4", "C#5"], duration: duration(1, 4), offset: 8 }),
        new NoteNode({ id: "precedence-after-c4", pitch: "C#4", duration: duration(1, 4), offset: 0 }),
        new NoteNode({ id: "precedence-after-c5", pitch: "C#5", duration: duration(1, 4), offset: 0 })
    ];
    const score = precedenceGraph(events, [
        ["precedence-chord", "precedence-after-c4"],
        ["precedence-after-c4", "precedence-after-c5"]
    ]);
    const plan = layout(score), svg = render(score, { layoutPlan: plan });
    assert.deepEqual(plan.systems[0].measures[0].eventPlacements.map(value => value.eventId),
        ["precedence-chord", "precedence-after-c4", "precedence-after-c5"]);
    assert.equal((group(svg, "precedence-chord").match(/accidental-sharp/g) ?? []).length, 2);
    assert.doesNotMatch(group(svg, "precedence-after-c4"), /class="accidental /);
    assert.doesNotMatch(group(svg, "precedence-after-c5"), /class="accidental /);
});

test("key defaults apply across octaves while cancellations remain position-specific", () => {
    const values = [
        new NoteNode({ id: "key-c4", pitch: "C#4", duration: duration(1, 4), offset: 0 }),
        new NoteNode({ id: "key-c5", pitch: "C#5", duration: duration(1, 4), offset: 1 }),
        new NoteNode({ id: "cancel-c4", pitch: "C4", duration: duration(1, 4), offset: 2 }),
        new NoteNode({ id: "key-c5-again", pitch: "C#5", duration: duration(1, 4), offset: 3 }),
        new NoteNode({ id: "restore-c4", pitch: "C#4", duration: duration(1, 4), offset: 4 })
    ];
    const svg = render(graph({ key: "D", measures: [values] }));
    assert.doesNotMatch(group(svg, "key-c4"), /class="accidental /);
    assert.doesNotMatch(group(svg, "key-c5"), /class="accidental /);
    assert.match(group(svg, "cancel-c4"), /accidental-natural/);
    assert.doesNotMatch(group(svg, "key-c5-again"), /class="accidental /);
    assert.match(group(svg, "restore-c4"), /accidental-sharp/);
});

test("mid-system key and meter changes reserve headers and remain deterministic", () => {
    const specs = [
        { key: "C", meter: [4, 4] },
        { key: "D", meter: [4, 4], events: [new NoteNode({ id: "after-change", pitch: "F#4", duration: duration(1, 4), offset: 0 })] },
        { key: "D", meter: [3, 4] },
        { key: "G", meter: [2, 4] },
        { key: "G", meter: [2, 4] }
    ];
    const score = changingSignatureGraph(specs), reversed = changingSignatureGraph(specs, true);
    const plan = layout(score), reversedPlan = layout(reversed);
    const svg = render(score, { layoutPlan: plan }), reversedSvg = render(reversed, { layoutPlan: reversedPlan });
    assert.equal(plan.systems.length, 1);
    assert.equal((svg.match(/class="time-signature"/g) ?? []).length, 3);
    assert.equal((svg.match(/class="key-signature"/g) ?? []).length, 2);
    assert.match(svg, /class="boundary-header" role="group" aria-label="D major key signature"/);
    assert.match(svg, /class="boundary-header" role="group" aria-label="3 over 4 time"/);
    assert.match(svg, /class="boundary-header" role="group" aria-label="cancel C sharp, G major key signature, 2 over 4 time"/);
    assert.doesNotMatch(group(svg, "after-change"), /class="accidental /);
    const changed = plan.systems[0].measures[1], event = changed.eventPlacements[0];
    assert.ok(event.x > changed.x + 60);
    assert.match(svg, /Measure 2: D major key, 4 over 4 time/);
    assert.deepEqual(reversedPlan.systems, plan.systems);
    assert.equal(reversedSvg, svg);
});

test("key transitions cancel only removed or changed signature alterations", () => {
    const transition = (from, to) => keySignatureTransition(
        from === null ? null : { accidentals: from },
        to === null ? null : { accidentals: to }
    );
    assert.deepEqual(transition(2, 1).cancellations.map(value => value.step), ["C"]);
    assert.deepEqual(transition(1, 2).cancellations.map(value => value.step), []);
    assert.deepEqual(transition(2, null).cancellations.map(value => value.step), ["F", "C"]);
    assert.deepEqual(transition(null, 2).cancellations.map(value => value.step), []);
    assert.deepEqual(transition(-2, -1).cancellations.map(value => value.step), ["E"]);
    assert.deepEqual(transition(-1, -2).cancellations.map(value => value.step), []);
    assert.equal(transition(7, -7).cancellationCount, 7);
    assert.ok(Object.isFrozen(transition(2, 1).cancellations));
});

test("D-major key changes share exact transition width and accessible cancellation metadata", () => {
    const specs = [
        { key: "D", meter: [4, 4] },
        { key: "G", meter: [4, 4] },
        { key: "C", meter: [3, 4] }
    ];
    const score = changingSignatureGraph(specs), plan = layout(score), svg = render(score, { layoutPlan: plan });
    const dToG = engravingHeader(score.node("change-measure:2"), score.node("change-measure:1"), plan.request.profile, false);
    const gToC = engravingHeader(score.node("change-measure:3"), score.node("change-measure:2"), plan.request.profile, false);
    assert.equal(dToG.cancellationCount, 1);
    assert.equal(dToG.keyGlyphCount, 1);
    assert.equal(dToG.keyWidth, 30);
    assert.equal(gToC.cancellationCount, 1);
    assert.equal(gToC.keyGlyphCount, 0);
    assert.match(svg, /aria-label="cancel C sharp, G major key signature"/);
    assert.match(svg, /aria-label="cancel F sharp, C major key signature, 3 over 4 time"/);
    assert.equal((svg.match(/key-cancellation key-C/g) ?? []).length, 1);
    assert.equal((svg.match(/key-cancellation key-F/g) ?? []).length, 1);
    assert.doesNotMatch(svg, /cancel F sharp and C sharp, G major/);
    const changed = plan.systems[0].measures[1], firstEvent = changed.eventPlacements[0];
    assert.ok(firstEvent.x >= changed.x + dToG.width);
});

test("system starts repeat active signatures and responsive breaks near changes are stable", () => {
    const specs = [
        { key: "C", meter: [4, 4] },
        { key: "D", meter: [3, 4] },
        { key: "D", meter: [3, 4] }
    ];
    const score = changingSignatureGraph(specs), narrow = layout(score, 260);
    const svg = render(score, { layoutPlan: narrow });
    assert.ok(narrow.systems.length > 1);
    assert.equal((svg.match(/class="time-signature"/g) ?? []).length, narrow.systems.length);
    assert.ok((svg.match(/class="key-signature"/g) ?? []).length >= 2);
    assert.equal(render(score, { layoutPlan: layout(score, 260) }), svg);
});
