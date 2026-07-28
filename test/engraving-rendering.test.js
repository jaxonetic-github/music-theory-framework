import test from "node:test";
import assert from "node:assert/strict";
import {
    ChordNode, Clef, KeySignature, LayoutEngine, LayoutStrategyRegistry, MeasureNode, NoteNode,
    PartNode, RendererStrategyRegistry, RenderingEngine, RestNode, ScoreEdge, ScoreGraph,
    ScoreGraphLayoutStrategy, ScoreRootNode, SvgScoreRenderer, VoiceNode
} from "../src/core/index.js";
import { accidentalGlyph } from "../src/core/Rendering/strategies/engraving.js";

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

test("duration classification is exact, normalized, immutable, and rejects unsupported rationals", () => {
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
    const sourceDuration = duration(1, 3);
    const unsupported = graph({ measures: [[new RestNode({ id: "unsupported", duration: sourceDuration, offset: 0 })]] });
    assert.throws(() => render(unsupported), /Unsupported engraving duration "1\/3"/);
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
    assert.equal((svg.match(/class="accidental accidental-sharp"/g) ?? []).length, 1);
    assert.equal((svg.match(/class="staff-line"/g) ?? []).length, 5);
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
    assert.match(svg, /class="boundary-header" role="group" aria-label="G major key signature, 2 over 4 time"/);
    assert.doesNotMatch(group(svg, "after-change"), /class="accidental /);
    const changed = plan.systems[0].measures[1], event = changed.eventPlacements[0];
    assert.ok(event.x > changed.x + 60);
    assert.match(svg, /Measure 2: D major key, 4 over 4 time/);
    assert.deepEqual(reversedPlan.systems, plan.systems);
    assert.equal(reversedSvg, svg);
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
