import test from "node:test";
import assert from "node:assert/strict";
import {
    LayoutBounds, LayoutEngine, LayoutEventPlacement, LayoutMeasure, LayoutMetadata, LayoutPlan,
    LayoutStrategy, LayoutStrategyRegistry, LayoutSystem, MeasureNode, NoteNode, PartNode,
    RendererStrategyRegistry, RenderingEngine, ScoreEdge, ScoreGraph, ScoreRootNode,
    ScoreGraphLayoutStrategy, SvgScoreRenderer, ValidationError, VoiceNode
} from "../src/core/index.js";

const previousPlacement = Object.freeze({
    eventId: "note:a", measureId: "measure:1", voiceId: "voice:1",
    x: 140, y: 112, width: 38, order: 1
});

function graph({ reverse = false } = {}) {
    const nodes = [
        new ScoreRootNode({ id: "score", title: "Legacy placement compatibility" }),
        new PartNode({ id: "part:1", name: "Staff" }),
        new MeasureNode({ id: "measure:1", number: 1 }),
        new VoiceNode({ id: "voice:1", index: 1 }),
        new NoteNode({ id: "note:a", pitch: "C#4", duration: { numerator: 1, denominator: 4 }, offset: 99 }),
        new NoteNode({ id: "note:b", pitch: "C#4", duration: { numerator: 1, denominator: 4 }, offset: 0 })
    ];
    const edges = [
        new ScoreEdge({ from: "score", to: "part:1", type: "contains" }),
        new ScoreEdge({ from: "part:1", to: "measure:1", type: "contains" }),
        new ScoreEdge({ from: "measure:1", to: "voice:1", type: "contains" }),
        new ScoreEdge({ from: "voice:1", to: "note:a", type: "contains" }),
        new ScoreEdge({ from: "voice:1", to: "note:b", type: "contains" })
    ];
    return new ScoreGraph({ nodes: reverse ? [...nodes].reverse() : nodes, edges: reverse ? [...edges].reverse() : edges });
}

class LegacyLayoutStrategy extends LayoutStrategy {
    constructor() {
        super({ id: "legacy", pluginId: "custom.layout" });
    }
    supports() { return true; }
    layout(request) {
        const placements = [
            new LayoutEventPlacement(previousPlacement),
            new LayoutEventPlacement({ ...previousPlacement, eventId: "note:b", x: 240, order: 2 })
        ];
        if (String(request.score.nodes.at(-1)?.id) === "score") placements.reverse();
        const measure = new LayoutMeasure({
            id: "measure:1", number: 1, x: 24, width: 320, naturalWidth: 320,
            eventPlacements: placements
        });
        return new LayoutPlan({
            request, score: request.score,
            systems: [new LayoutSystem({
                id: "legacy:system", partId: "part:1", sequence: 1, measures: [measure],
                y: 54, height: 120, naturalWidth: 368
            })],
            bounds: new LayoutBounds({ width: 600, height: 220 }),
            metadata: new LayoutMetadata({
                profileId: request.profile.id, availableWidth: request.availableWidth,
                naturalWidth: 368, strategy: { pluginId: "custom.layout", strategyId: "legacy" }
            })
        });
    }
}

function legacyPlan(score) {
    const registry = new LayoutStrategyRegistry(), strategy = new LegacyLayoutStrategy();
    registry.register(strategy.pluginId, strategy);
    return new LayoutEngine(registry).plan({
        score, availableWidth: 600, pluginId: "custom.layout", strategyId: "legacy"
    });
}

function render(score, plan) {
    const registry = new RendererStrategyRegistry(), renderer = new SvgScoreRenderer();
    registry.register(renderer.pluginId, renderer);
    return new RenderingEngine(registry).render(score, { layoutPlan: plan, accessibleId: "legacy-placement" });
}

test("the previous LayoutEventPlacement constructor normalizes absent onset without mutating input", () => {
    const input = { ...previousPlacement }, before = structuredClone(input);
    const placement = new LayoutEventPlacement(input);
    assert.deepEqual(input, before);
    assert.equal(placement.onset, null);
    assert.equal(placement.timingMode, "legacy-placement-order");
    assert.equal(Object.isFrozen(placement), true);
    assert.equal(JSON.parse(JSON.stringify(placement)).onset, null);
});

test("exact onset remains normalized, immutable, validated, and distinct from absence", () => {
    const exact = new LayoutEventPlacement({ ...previousPlacement, onset: { numerator: 0, denominator: 8 } });
    assert.deepEqual(exact.onset, { numerator: 0, denominator: 1 });
    assert.equal(exact.timingMode, "exact-onset");
    assert.equal(Object.isFrozen(exact.onset), true);
    assert.notEqual(exact.onset, null);
    for (const onset of [{}, { numerator: -1, denominator: 4 }, { numerator: 1, denominator: 0 },
        { numerator: 1.5, denominator: 4 }, "0/1"]) {
        assert.throws(() => new LayoutEventPlacement({ ...previousPlacement, onset }), /exact rational/);
    }
});

test("a legacy custom strategy plan preserves coordinates and renders in deterministic visual order", () => {
    const firstScore = graph(), reversedScore = graph({ reverse: true });
    const first = legacyPlan(firstScore), reversed = legacyPlan(reversedScore);
    assert.equal(first.timingMode, "legacy-placement-order");
    assert.equal(first.systems[0].measures[0].timingMode, "legacy-placement-order");
    assert.deepEqual(first.placements.map(value => [value.eventId, value.x, value.y]),
        [["note:a", 140, 112], ["note:b", 240, 112]]);
    const firstSvg = render(firstScore, first), reversedSvg = render(reversedScore, reversed);
    assert.match(firstSvg, /data-node-id="note:a"[^>]*data-x="140"/);
    assert.match(firstSvg, /data-node-id="note:b"[^>]*data-x="240"/);
    assert.equal((firstSvg.match(/accidental-sharp/g) ?? []).length, 1);
    assert.equal(firstSvg, reversedSvg);
});

test("one measure rejects ambiguous mixed exact and legacy placement timing", () => {
    const legacy = new LayoutEventPlacement(previousPlacement);
    const exact = new LayoutEventPlacement({
        ...previousPlacement, eventId: "note:b", order: 2, onset: { numerator: 1, denominator: 4 }
    });
    assert.throws(() => new LayoutMeasure({
        id: "measure:1", number: 1, x: 0, width: 300, naturalWidth: 300,
        eventPlacements: [legacy, exact]
    }), error => error instanceof ValidationError && /measure:1.*cannot mix/.test(error.message));
});

test("the built-in strategy retains exact-onset capability for every musical placement", () => {
    const score = graph(), registry = new LayoutStrategyRegistry(), strategy = new ScoreGraphLayoutStrategy();
    registry.register(strategy.pluginId, strategy);
    const plan = new LayoutEngine(registry).plan({ score, availableWidth: 600 });
    assert.equal(plan.timingMode, "exact-onset");
    assert.equal(plan.metadata.timingMode, "exact-onset");
    assert.ok(plan.placements.length > 0);
    assert.ok(plan.placements.every(value => value.timingMode === "exact-onset" && value.onset !== null));
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.placements[0].onset), true);
});
