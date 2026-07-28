import { ValidationError } from "../Foundation/index.js";
import { LayoutRequest } from "./LayoutRequest.js";
import { LayoutStrategy } from "./LayoutStrategy.js";
import { LayoutBounds, LayoutEventPlacement, LayoutMeasure, LayoutMetadata, LayoutPlan, LayoutSystem } from "./values.js";
import { engravingHeader } from "./engravingHeaders.js";
import { engravingDurationStyle } from "./engravingDuration.js";
import { chordHeadDisplacement, chordHeadGeometry } from "./chordGeometry.js";

const eventTypes = new Set(["note", "rest", "chord"]);
function children(score, parent, type) {
    const ids = new Set(score.edges.filter(edge => String(edge.type) === "contains" && String(edge.from) === String(parent.id)).map(edge => String(edge.to)));
    return score.nodes.filter(node => ids.has(String(node.id)) && (!type || String(node.type) === type));
}
function idCompare(a, b) { return String(a.id).localeCompare(String(b.id)); }
function events(score, voice) {
    const values = children(score, voice).filter(node => eventTypes.has(String(node.type)));
    const ids = new Set(values.map(value => String(value.id))), next = new Map(values.map(value => [String(value.id), []])), indegree = new Map(values.map(value => [String(value.id), 0]));
    for (const edge of score.edges) {
        if (String(edge.type) !== "next" || !ids.has(String(edge.from)) || !ids.has(String(edge.to))) continue;
        next.get(String(edge.from)).push(String(edge.to));
        indegree.set(String(edge.to), indegree.get(String(edge.to)) + 1);
    }
    const compare = (a, b) => a.offset - b.offset || idCompare(a, b), available = values.filter(value => indegree.get(String(value.id)) === 0).sort(compare), ordered = [];
    while (available.length) {
        const value = available.shift(); ordered.push(value);
        for (const target of next.get(String(value.id)).sort()) {
            const remaining = indegree.get(target) - 1; indegree.set(target, remaining);
            if (!remaining) { available.push(score.node(target)); available.sort(compare); }
        }
    }
    if (ordered.length !== values.length) throw new ValidationError("Layout event precedence contains a cycle.");
    return ordered;
}
function accidentalCount(value) { return (String(value).match(/[#bx♯♭]/g) ?? []).length; }
function eventWidth(event, profile) {
    const style = engravingDurationStyle(event.duration);
    const rhythmicWidth = style.flags ? profile.flagWidth : 0;
    const dotWidth = style.dotCount * profile.augmentationDotWidth;
    const ratioWidth = style.ratio ? 10 + String(style.ratio.denominator).length * 7 : 0;
    if (String(event.type) === "rest") return profile.restWidth + rhythmicWidth + dotWidth + ratioWidth;
    const pitches = [...(String(event.type) === "chord" ? event.notes : [event.pitch])].sort((a, b) => {
        const letters = "CDEFGAB", parse = value => {
            const match = /^([A-G])(?:#{1,2}|b{1,2}|x)?(-?\d+)$/.exec(String(value));
            return Number(match?.[2] ?? 0) * 7 + letters.indexOf(match?.[1] ?? "C");
        };
        return parse(a) - parse(b) || String(a).localeCompare(String(b));
    });
    const accidentals = pitches.length;
    const displaced = String(event.type) === "chord" && chordHeadGeometry(pitches).hasAdjacentSecond;
    return profile.noteheadWidth + profile.stemWidth + rhythmicWidth + dotWidth + ratioWidth
        + accidentals * profile.accidentalWidth + (displaced ? chordHeadDisplacement * 2 : 0);
}
function eventExtents(event, profile) {
    const width = eventWidth(event, profile);
    const displaced = String(event.type) === "chord" && chordHeadGeometry([...event.notes]).hasAdjacentSecond;
    const left = String(event.type) === "chord"
        ? event.notes.length * profile.accidentalWidth + (displaced ? chordHeadDisplacement : 0)
        : String(event.type) === "note" ? profile.accidentalWidth : 0;
    return Object.freeze({ left, right: width - left, width });
}
function semanticIds(request, measureId) { return request.semanticSystems.filter(system => system.measureIds.includes(measureId)).map(system => system.id); }
function addDuration(onset, duration) {
    const numerator = onset.numerator * duration.denominator + duration.numerator * onset.denominator;
    const denominator = onset.denominator * duration.denominator;
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) throw new ValidationError("Layout rhythmic onset exceeds the safe exact-rational range.");
    let a = numerator, b = denominator;
    while (b) { const next = a % b; a = b; b = next; }
    return { numerator: numerator / a, denominator: denominator / a };
}
function compareOnset(a, b) {
    const difference = BigInt(a.onset.numerator) * BigInt(b.onset.denominator)
        - BigInt(b.onset.numerator) * BigInt(a.onset.denominator);
    return difference < 0n ? -1 : difference > 0n ? 1
        : String(a.eventId ?? a.event?.id).localeCompare(String(b.eventId ?? b.event?.id))
            || String(a.voiceId ?? a.voice?.id).localeCompare(String(b.voiceId ?? b.voice?.id));
}
function onsetColumns(voices, voiceEvents, profile) {
    const stream = [];
    voices.forEach((voice, voiceIndex) => {
        let onset = { numerator: 0, denominator: 1 };
        voiceEvents[voiceIndex].forEach((event, index) => {
            stream.push(Object.freeze({ event, voice, order: index + 1, onset: Object.freeze(onset), extents: eventExtents(event, profile) }));
            onset = addDuration(onset, event.duration);
        });
    });
    stream.sort(compareOnset);
    const columns = [];
    for (const value of stream) {
        const previous = columns.at(-1);
        const same = previous && BigInt(previous.onset.numerator) * BigInt(value.onset.denominator)
            === BigInt(value.onset.numerator) * BigInt(previous.onset.denominator);
        if (same) previous.events.push(value);
        else columns.push({ onset: value.onset, events: [value] });
    }
    return Object.freeze(columns.map(column => Object.freeze({
        onset: column.onset,
        events: Object.freeze(column.events),
        left: Math.max(...column.events.map(value => value.extents.left)),
        right: Math.max(...column.events.map(value => value.extents.right))
    })));
}

export class ScoreGraphLayoutStrategy extends LayoutStrategy {
    constructor({ pluginId = "core.layout.score-graph" } = {}) { super({ id: "score-graph", pluginId }); }
    supports(request) { return request instanceof LayoutRequest; }
    layout(input) {
        const request = LayoutRequest.from(input), score = request.score, profile = request.profile;
        const contentWidth = request.availableWidth - request.horizontalPadding * 2;
        const parts = [...score.nodesOfType("part")].sort(idCompare), systems = [];
        let globalSequence = 0, y = 54;
        for (const part of parts) {
            const measures = children(score, part, "measure").sort((a, b) => a.number - b.number || idCompare(a, b));
            const prepared = measures.map((measure, index) => {
                const voices = children(score, measure, "voice").sort((a, b) => a.index - b.index || idCompare(a, b));
                const voiceEvents = voices.map(voice => events(score, voice));
                const columns = onsetColumns(voices, voiceEvents, profile);
                const columnWidth = columns.reduce((sum, column) => sum + column.left + column.right + profile.eventGap, 0);
                const bodyWidth = Math.max(request.minimumSystemWidth, profile.measurePadding * 2 + profile.barlineWidth + columnWidth);
                return { measure, previousMeasure: index ? measures[index - 1] : null, voices, voiceEvents, columns, bodyWidth };
            });
            let batch = [];
            const flush = () => {
                if (!batch.length) return;
                globalSequence += 1;
                const systemY = y, systemHeight = profile.staffHeight;
                const naturalWidth = request.horizontalPadding * 2 + batch.reduce((sum, value, index) =>
                    sum + value.bodyWidth + engravingHeader(value.measure, value.previousMeasure, profile, index === 0).width, 0);
                const overflow = naturalWidth > request.availableWidth;
                let measureX = request.horizontalPadding;
                const layoutMeasures = batch.map((value, measureIndex) => {
                    const header = engravingHeader(value.measure, value.previousMeasure, profile, measureIndex === 0).width;
                    const width = value.bodyWidth + header;
                    const placements = [];
                    let columnX = measureX + header + profile.measurePadding;
                    value.columns.forEach(column => {
                        const anchor = columnX + column.left;
                        column.events.forEach(({ event, voice, order, onset, extents }) => {
                            placements.push(new LayoutEventPlacement({ eventId: event.id, measureId: value.measure.id, voiceId: voice.id, x: anchor, y: systemY + 58, width: extents.width, order, onset }));
                        });
                        columnX += column.left + column.right + profile.eventGap;
                    });
                    placements.sort(compareOnset);
                    const result = new LayoutMeasure({ id: value.measure.id, number: value.measure.number, x: measureX, width, naturalWidth: width, overflow: width > contentWidth, eventPlacements: placements, timingMode: "exact-onset" });
                    measureX += width;
                    return result;
                });
                const first = batch[0].measure, last = batch.at(-1).measure;
                const id = `${score.score.id}:layout:${profile.id}:part:${part.id}:system:${globalSequence}:${first.id}:${last.id}`;
                systems.push(new LayoutSystem({ id, partId: part.id, sequence: globalSequence, semanticSystemIds: Object.freeze([...new Set(batch.flatMap(value => semanticIds(request, String(value.measure.id))))]), measures: layoutMeasures, y: systemY, height: systemHeight, naturalWidth, overflow }));
                y += systemHeight + request.systemSpacing;
                batch = [];
            };
            for (const value of prepared) {
                const hint = request.semanticSystems.find(system => system.measureIds.includes(String(value.measure.id)));
                const firstInHint = hint?.measureIds[0] === String(value.measure.id);
                if (batch.length && firstInHint && hint.breakPolicy === "mandatory") flush();
                const proposed = batch.reduce((sum, item, index) =>
                    sum + item.bodyWidth + engravingHeader(item.measure, item.previousMeasure, profile, index === 0).width, 0)
                    + value.bodyWidth + engravingHeader(value.measure, value.previousMeasure, profile, batch.length === 0).width;
                if (batch.length && proposed > contentWidth) flush();
                batch.push(value);
                if (engravingHeader(value.measure, value.previousMeasure, profile, true).width + value.bodyWidth > contentWidth) flush();
            }
            flush();
        }
        const naturalWidth = Math.max(0, ...systems.map(system => system.naturalWidth)), renderedWidth = Math.max(request.availableWidth, naturalWidth);
        const height = Math.max(1, y - request.systemSpacing + 24);
        return new LayoutPlan({ request, score, systems, bounds: new LayoutBounds({ x: 0, y: 0, width: renderedWidth, height }), metadata: new LayoutMetadata({ profileId: profile.id, availableWidth: request.availableWidth, naturalWidth, overflow: systems.some(system => system.overflow), systemIds: systems.map(system => system.id), timingMode: "exact-onset", engravingMetrics: { staffLineSpacing: profile.staffLineSpacing, noteheadWidth: profile.noteheadWidth, accidentalWidth: profile.accidentalWidth }, strategy: { pluginId: String(this.pluginId), strategyId: String(this.id) } }) });
    }
}
