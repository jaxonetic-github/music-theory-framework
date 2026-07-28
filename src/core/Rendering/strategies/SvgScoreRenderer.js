import { ScoreGraph } from "../../Notation/index.js";
import { LayoutPlan, LayoutEngine, LayoutStrategyRegistry, ScoreGraphLayoutStrategy } from "../../Layout/index.js";
import { engravingHeader, keySignatureTransition } from "../../Layout/engravingHeaders.js";
import { chordHeadGeometry } from "../../Layout/chordGeometry.js";
import { ValidationError } from "../../Foundation/index.js";
import { RendererStrategy } from "./RendererStrategy.js";
import { metadataText, xmlAttribute, xmlText } from "./svg.js";
import {
    ENGRAVING, accidentalGlyph, clefGlyph, durationRatioGlyph, durationStyle, expectedKeyAccidentals,
    keySignatureGlyph, ledgerLines, notehead, parseWrittenPitch, pitchY, restGlyph,
    stemAndFlags, timeSignatureGlyph
} from "./engraving.js";

function node(score, id) {
    const value = score.node(id);
    if (!value) throw new ValidationError(`Layout references unknown score node "${id}".`);
    return value;
}
function metadataAttribute(value) { return ` data-metadata="${xmlAttribute(metadataText(value.metadata))}"`; }
function safeId(value) { return String(value).replace(/[^A-Za-z0-9_.:-]/g, "-"); }
function children(score, parent, type) {
    const ids = new Set(score.edges.filter(edge => String(edge.type) === "contains" && String(edge.from) === String(parent.id)).map(edge => String(edge.to)));
    return score.nodes.filter(value => ids.has(String(value.id)) && (!type || String(value.type) === type));
}
function accidentalName(value) {
    if (value === -2) return "double-flat";
    if (value === -1) return "flat";
    if (value === 0) return "natural";
    if (value === 1) return "sharp";
    if (value === 2) return "double-sharp";
    throw new ValidationError(`Unsupported written accidental alteration: ${String(value)}.`);
}
function semanticEvent(event) {
    if (String(event.type) === "rest") {
        const style = durationStyle(event.duration);
        const dots = style.dotCount === 1 ? "dotted " : style.dotCount === 2 ? "double-dotted " : style.dotCount === 3 ? "triple-dotted " : "";
        return `${event.duration} ${dots}${style.kind} rest`;
    }
    if (String(event.type) === "chord") return `${event.duration} chord ${event.notes.map(String).join(", ")}`;
    return `${event.duration} note ${event.pitch}`;
}
function directionFor(ys, staffTop, voiceIndex, polyphonic) {
    if (polyphonic) return voiceIndex % 2 ? "up" : "down";
    return ys.reduce((sum, value) => sum + value, 0) / ys.length >= staffTop + 24 ? "up" : "down";
}
function augmentationDot(x, y, style) {
    return Array.from({ length: style.dotCount }, (_, index) =>
        `<circle class="augmentation-dot" data-dot="${index+1}" cx="${x + index * 7}" cy="${y-3}" r="2.1" fill="currentColor"/>`).join("");
}
function renderPitchedEvent(event, placement, clef, staffTop, voiceIndex, polyphonic, needed) {
    const pitches = String(event.type) === "chord" ? event.notes : [event.pitch];
    const parsed = pitches.map(parseWrittenPitch);
    const ys = pitches.map(pitch => pitchY(pitch, clef, staffTop));
    const style = durationStyle(event.duration), direction = directionFor(ys, staffTop, voiceIndex, polyphonic);
    const geometry = chordHeadGeometry(pitches, direction), offsets = geometry.offsets;
    const accidentalEntries = geometry.sorted.filter(({ index }) => needed[index]);
    const accidentalColumns = new Map(accidentalEntries.map(({ index }, column) => [index, column]));
    const accidentals = needed.map((kind, index) => {
        if (!kind) return "";
        return accidentalGlyph(kind, placement.x + offsets[index] - 15
            - accidentalColumns.get(index) * ENGRAVING.accidentalGap, ys[index]);
    }).join("");
    const heads = ys.map((y, index) => {
        const center = placement.x + offsets[index];
        return `<g class="chord-member" data-written-position="${parsed[index].diatonic}" data-head-offset="${offsets[index]}">${ledgerLines(center, y, staffTop)}${notehead(placement.x, y, style.open, offsets[index])}</g>`;
    }).join("");
    const stemY = direction === "up" ? Math.max(...ys) : Math.min(...ys);
    const stemX = placement.x + (direction === "up" ? Math.max(...offsets) : Math.min(...offsets));
    const dots = ys.map((y, index) =>
        augmentationDot(placement.x + offsets[index] + ENGRAVING.noteRx + 7, y, style)).join("");
    const pitchData = pitches.map(String).join(" ");
    const pitchAttribute = String(event.type) === "note" ? ` data-pitch="${xmlAttribute(event.pitch)}"` : "";
    return `<g class="event ${event.type}" data-node-id="${xmlAttribute(event.id)}" data-order="${placement.order}" role="img" aria-label="${xmlAttribute(semanticEvent(event))}" data-x="${placement.x}" data-offset="${event.offset}" data-duration="${xmlAttribute(event.duration)}"${pitchAttribute} data-pitches="${xmlAttribute(pitchData)}" data-visible-pitch-labels="false"${metadataAttribute(event)}>${accidentals}${heads}${stemAndFlags(stemX, stemY, direction, style)}${dots}${durationRatioGlyph(placement.x, Math.min(...ys)-52, style)}</g>`;
}
function renderRest(event, placement, staffTop) {
    return `<g class="event rest" data-node-id="${xmlAttribute(event.id)}" data-order="${placement.order}" role="img" aria-label="${xmlAttribute(semanticEvent(event))}" data-x="${placement.x}" data-width="${placement.width}" data-offset="${event.offset}" data-duration="${xmlAttribute(event.duration)}"${metadataAttribute(event)}>${restGlyph(placement.x, staffTop, event.duration)}</g>`;
}
function renderVoice(score, voice, placements, clef, staffTop, polyphonic, accidentalDecisions) {
    return `<g class="voice" data-node-id="${xmlAttribute(voice.id)}" data-index="${voice.index}" aria-label="Voice ${voice.index}"${metadataAttribute(voice)}>${placements.map(placement => {
        const event = node(score, placement.eventId);
        return String(event.type) === "rest"
            ? renderRest(event, placement, staffTop)
            : renderPitchedEvent(event, placement, clef, staffTop, voice.index, polyphonic, accidentalDecisions.get(String(event.id)) ?? []);
    }).join("")}</g>`;
}
function legacyPlacementOrder(placements) {
    return [...placements].sort((a,b)=>
        a.x-b.x||a.order-b.order||String(a.eventId).localeCompare(String(b.eventId))||String(a.voiceId).localeCompare(String(b.voiceId)));
}
function accidentalDecisions(score, placements, key) {
    const state = new Map(), defaults = expectedKeyAccidentals(key), result = new Map();
    const exact = placements[0]?.timingMode === "exact-onset";
    const ordered = exact ? placements : legacyPlacementOrder(placements);
    const sameBatch = exact
        ? (a, b) => BigInt(a.onset.numerator) * BigInt(b.onset.denominator)
            === BigInt(b.onset.numerator) * BigInt(a.onset.denominator)
        : (a, b) => a.x === b.x;
    for (let start = 0; start < ordered.length;) {
        let end = start + 1;
        while (end < ordered.length && sameBatch(ordered[start], ordered[end])) end += 1;
        const updates = new Map();
        for (const placement of ordered.slice(start, end)) {
            const event = node(score, placement.eventId);
            if (String(event.type) === "rest") continue;
            const pitches = (String(event.type) === "chord" ? event.notes : [event.pitch]).map(parseWrittenPitch);
            const needed = pitches.map(pitch => {
                const position = `${pitch.letter}:${pitch.octave}`;
                const current = state.has(position) ? state.get(position) : (defaults.get(pitch.letter) ?? 0);
                return current === pitch.accidental ? null : accidentalName(pitch.accidental);
            });
            for (const pitch of pitches) {
                const position = `${pitch.letter}:${pitch.octave}`, alterations = updates.get(position) ?? new Set();
                alterations.add(pitch.accidental); updates.set(position, alterations);
            }
            result.set(String(event.id), Object.freeze(needed));
        }
        for (const [position, alterations] of [...updates].sort(([a], [b]) => a.localeCompare(b))) {
            state.set(position, alterations.size === 1 ? [...alterations][0] : null);
        }
        start = end;
    }
    return result;
}
function renderMeasure(score, layoutMeasure, system, index, staffTop, previousMeasure, profile) {
    const measure = node(score, layoutMeasure.id), part = node(score, system.partId), key = measure.keySignature;
    const placements = layoutMeasure.timingMode === "exact-onset"
        ? layoutMeasure.eventPlacements : legacyPlacementOrder(layoutMeasure.eventPlacements);
    const byVoice = new Map();
    for (const placement of placements) {
        const list = byVoice.get(placement.voiceId) ?? [];
        list.push(placement);
        byVoice.set(placement.voiceId, list);
    }
    const measureVoices = children(score, measure, "voice").sort((a, b) => a.index - b.index || String(a.id).localeCompare(String(b.id)));
    const decisions = accidentalDecisions(score, placements, key);
    const voices = measureVoices
        .map(voice => renderVoice(score, voice, byVoice.get(String(voice.id)) ?? [], part.clef, staffTop, measureVoices.length > 1, decisions)).join("");
    const end = layoutMeasure.x + layoutMeasure.width;
    const boundary = engravingHeader(measure, previousMeasure, profile, index === 0);
    let headerX = layoutMeasure.x + 10, header = "";
    if (boundary.showClef) { header += clefGlyph(part.clef, headerX, staffTop); headerX += profile.clefWidth; }
    if (boundary.showKey) {
        header += keySignatureGlyph(key, part.clef, headerX, staffTop, index === 0 ? null : previousMeasure?.keySignature, boundary.keyTransition);
        headerX += boundary.keyWidth;
    }
    if (boundary.showMeter) header += timeSignatureGlyph(measure, headerX + profile.timeSignatureWidth / 2, staffTop);
    const headerLabel = [
        boundary.showClef ? `${part.clef.type} clef` : null,
        boundary.showKey && boundary.keyTransition.cancellations.length
            ? `cancel ${boundary.keyTransition.cancellations.map(entry => `${entry.step} ${entry.alteration > 0 ? "sharp" : "flat"}`).join(" and ")}`
            : null,
        boundary.showKey ? (key ? `${key.tonic} ${key.mode} key signature` : "no key signature") : null,
        boundary.showMeter ? `${measure.value.beats} over ${measure.value.beatUnit} time` : null
    ].filter(Boolean).join(", ");
    if (header) header = `<g class="boundary-header" role="group" aria-label="${xmlAttribute(headerLabel)}" data-header-width="${boundary.width}">${header}</g>`;
    return `<g class="measure" role="group" aria-label="Measure ${measure.number}, ${measure.value.beats} over ${measure.value.beatUnit}, ${key ? `${key.tonic} ${key.mode} key` : "no key signature"}" data-node-id="${xmlAttribute(measure.id)}" data-number="${measure.number}" data-beats="${measure.value.beats}" data-beat-unit="${measure.value.beatUnit}" data-key-tonic="${xmlAttribute(key?.tonic ?? "")}" data-key-mode="${xmlAttribute(key?.mode ?? "none")}" data-key-accidentals="${key?.accidentals ?? 0}" data-layout-width="${layoutMeasure.width}" data-overflow="${layoutMeasure.overflow}"${metadataAttribute(measure)}>${header}${voices}<line class="barline" x1="${end}" x2="${end}" y1="${staffTop}" y2="${staffTop+ENGRAVING.lineGap*4}" stroke="currentColor" stroke-width="1.6"/></g>`;
}
function renderSystem(score, system, profile) {
    const part = node(score, system.partId), staffTop = system.y + 34;
    const partMeasures = children(score, part, "measure").sort((a,b)=>a.number-b.number||String(a.id).localeCompare(String(b.id)));
    const start = system.measures[0].x, end = system.measures.at(-1).x + system.measures.at(-1).width;
    const lines = Array.from({ length: 5 }, (_, index) => {
        const y = staffTop + index * ENGRAVING.lineGap;
        return `<line class="staff-line" data-staff-line="${index+1}" x1="${start}" x2="${end}" y1="${y}" y2="${y}" stroke="currentColor" stroke-width="${ENGRAVING.stroke}"/>`;
    }).join("");
    return `<g class="part layout-system" role="group" aria-label="${xmlAttribute(`${part.name}, ${part.clef.type} clef`)}" data-layout-system-id="${xmlAttribute(system.id)}" data-node-id="${xmlAttribute(part.id)}" data-name="${xmlAttribute(part.name)}" data-instrument="${xmlAttribute(part.instrument)}" data-clef="${xmlAttribute(part.clef.type)}" data-clef-line="${part.clef.line}" data-clef-octave-shift="${part.clef.octaveShift}" data-overflow="${system.overflow}"${metadataAttribute(part)}><text class="part-name" x="${start}" y="${system.y+16}" font-size="12">${xmlText(part.name)}</text>${lines}<line class="barline system-start" x1="${start}" x2="${start}" y1="${staffTop}" y2="${staffTop+ENGRAVING.lineGap*4}" stroke="currentColor" stroke-width="1.6"/>${system.measures.map((layoutMeasure,index) => {
        const measure = node(score, layoutMeasure.id), measureIndex = partMeasures.findIndex(value => String(value.id) === String(measure.id));
        return renderMeasure(score, layoutMeasure, system, index, staffTop, measureIndex > 0 ? partMeasures[measureIndex - 1] : null, profile);
    }).join("")}</g>`;
}
function defaultPlan(score, options) {
    const registry = new LayoutStrategyRegistry(), strategy = new ScoreGraphLayoutStrategy();
    registry.register(strategy.pluginId, strategy);
    return new LayoutEngine(registry).plan({ score, availableWidth: options.width, profile: options.layoutProfile, horizontalPadding: options.horizontalPadding, minimumSystemWidth: options.minimumSystemWidth, staffSpacing: options.staffSpacing, systemSpacing: options.systemSpacing, semanticSystems: options.semanticSystems });
}

export class SvgScoreRenderer extends RendererStrategy {
    constructor({ pluginId = "core.rendering.svg" } = {}) { super({ id: "svg", pluginId, format: "svg" }); }
    supports(score) { return score instanceof ScoreGraph; }
    render(score, options = {}) {
        const plan = options.layoutPlan ?? defaultPlan(score, options);
        if (!(plan instanceof LayoutPlan) || plan.score !== score) throw new ValidationError("SvgScoreRenderer requires an authoritative LayoutPlan for its ScoreGraph.");
        const width = plan.bounds.width, height = Number(options.height ?? Math.max(240, plan.bounds.height + 45));
        if (!Number.isFinite(height) || height <= 0) throw new ValidationError("SVG height must be a positive finite number.");
        const title = options.title ?? score.score.title, metadata = options.metadata ?? score.score.metadata;
        const prefix = safeId(options.accessibleId ?? `${score.score.id}-${plan.metadata.profileId}`);
        const titleId = `${prefix}-score-title`, descriptionId = `${prefix}-score-description`;
        const signatureText = [...score.nodesOfType("part")].sort((a,b)=>String(a.id).localeCompare(String(b.id))).flatMap(part => {
            const measures = children(score, part, "measure").sort((a,b)=>a.number-b.number||String(a.id).localeCompare(String(b.id)));
            return measures.map((measure, index) => {
                const transition = keySignatureTransition(index ? measures[index - 1].keySignature : null, measure.keySignature, index === 0);
                const cancellations = transition.cancellations.length
                    ? `cancel ${transition.cancellations.map(entry => `${entry.step} ${entry.alteration > 0 ? "sharp" : "flat"}`).join(" and ")}, `
                    : "";
                return `Measure ${measure.number}: ${cancellations}${measure.keySignature ? `${measure.keySignature.tonic} ${measure.keySignature.mode} key` : "no key signature"}, ${measure.value.beats} over ${measure.value.beatUnit} time`;
            });
        }).join("; ");
        const description = `${title}. Conventional staff notation with ${plan.systems.length} visual system${plan.systems.length === 1 ? "" : "s"}. ${[...score.nodesOfType("part")].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(part => `${part.name}, ${part.clef.type} clef`).join("; ")}. ${signatureText}.`;
        const content = plan.systems.map(system => renderSystem(score, system, plan.request.profile)).join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${xmlAttribute(titleId)} ${xmlAttribute(descriptionId)}" data-layout-profile="${xmlAttribute(plan.metadata.profileId)}" data-available-width="${plan.metadata.availableWidth}" data-natural-width="${plan.metadata.naturalWidth}" data-layout-metadata="${xmlAttribute(metadataText(plan.metadata))}" data-engraving-glyphs="renderer-owned-svg"><title id="${xmlAttribute(titleId)}">${xmlText(title)}</title><desc id="${xmlAttribute(descriptionId)}">${xmlText(description)}</desc><metadata>${xmlText(metadataText(metadata))}</metadata><g class="score" data-node-id="${xmlAttribute(score.score.id)}"${metadataAttribute(score.score)}><text class="score-title" x="24" y="26" font-size="16" font-weight="600">${xmlText(title)}</text>${content}</g></svg>`;
    }
}
export default SvgScoreRenderer;
