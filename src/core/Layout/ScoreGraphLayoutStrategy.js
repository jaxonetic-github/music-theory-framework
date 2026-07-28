import { ValidationError } from "../Foundation/index.js";
import { LayoutRequest } from "./LayoutRequest.js";
import { LayoutStrategy } from "./LayoutStrategy.js";
import { LayoutBounds, LayoutEventPlacement, LayoutMeasure, LayoutMetadata, LayoutPlan, LayoutSystem } from "./values.js";
import { engravingHeader } from "./engravingHeaders.js";
import { engravingDurationStyle } from "./engravingDuration.js";

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
    if (String(event.type) === "rest") return profile.restWidth + rhythmicWidth + dotWidth;
    const pitches = String(event.type) === "chord" ? event.notes : [event.pitch];
    const accidentals = pitches.length;
    const seconds = pitches.slice(1).filter((pitch, index) => {
        const letters = "CDEFGAB", previous = String(pitches[index]), current = String(pitch);
        return Math.abs(letters.indexOf(current[0]) - letters.indexOf(previous[0])) === 1;
    }).length;
    return profile.noteheadWidth + profile.stemWidth + rhythmicWidth + dotWidth + accidentals * profile.accidentalWidth + seconds * profile.noteheadWidth * .55;
}
function semanticIds(request, measureId) { return request.semanticSystems.filter(system => system.measureIds.includes(measureId)).map(system => system.id); }

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
                const bodyWidth = Math.max(request.minimumSystemWidth, profile.measurePadding * 2 + profile.barlineWidth,
                    ...voiceEvents.map(list => profile.measurePadding * 2 + list.reduce((sum, event) => sum + eventWidth(event, profile) + profile.eventGap, 0) + profile.barlineWidth));
                return { measure, previousMeasure: index ? measures[index - 1] : null, voices, voiceEvents, bodyWidth };
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
                    value.voices.forEach((voice, voiceIndex) => {
                        let x = measureX + header + profile.measurePadding;
                        value.voiceEvents[voiceIndex].forEach((event, index) => {
                            const glyphWidth = eventWidth(event, profile);
                            const accidentalReserve = String(event.type) === "chord"
                                ? event.notes.length * profile.accidentalWidth
                                : String(event.type) === "note" ? profile.accidentalWidth : 0;
                            x += accidentalReserve;
                            placements.push(new LayoutEventPlacement({ eventId: event.id, measureId: value.measure.id, voiceId: voice.id, x, y: systemY + 58, width: glyphWidth, order: index + 1 }));
                            x += glyphWidth - accidentalReserve + profile.eventGap;
                        });
                    });
                    const result = new LayoutMeasure({ id: value.measure.id, number: value.measure.number, x: measureX, width, naturalWidth: width, overflow: width > contentWidth, eventPlacements: placements });
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
        return new LayoutPlan({ request, score, systems, bounds: new LayoutBounds({ x: 0, y: 0, width: renderedWidth, height }), metadata: new LayoutMetadata({ profileId: profile.id, availableWidth: request.availableWidth, naturalWidth, overflow: systems.some(system => system.overflow), systemIds: systems.map(system => system.id), engravingMetrics: { staffLineSpacing: profile.staffLineSpacing, noteheadWidth: profile.noteheadWidth, accidentalWidth: profile.accidentalWidth }, strategy: { pluginId: String(this.pluginId), strategyId: String(this.id) } }) });
    }
}
