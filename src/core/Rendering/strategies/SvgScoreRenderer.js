import { ScoreGraph } from "../../Notation/index.js";
import { LayoutPlan, LayoutEngine, LayoutStrategyRegistry, ScoreGraphLayoutStrategy } from "../../Layout/index.js";
import { ValidationError } from "../../Foundation/index.js";
import { RendererStrategy } from "./RendererStrategy.js";
import { metadataText, xmlAttribute, xmlText } from "./svg.js";
import {
    ENGRAVING, accidentalGlyph, clefGlyph, durationStyle, expectedKeyAccidentals,
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
function accidentalName(value) { return value === 2 ? "double-sharp" : value === 1 ? "sharp" : value === -1 ? "flat" : "natural"; }
function semanticEvent(event) {
    if (String(event.type) === "rest") return `${event.duration} rest`;
    if (String(event.type) === "chord") return `${event.duration} chord ${event.notes.map(String).join(", ")}`;
    return `${event.duration} note ${event.pitch}`;
}
function directionFor(ys, staffTop, voiceIndex, polyphonic) {
    if (polyphonic) return voiceIndex % 2 ? "up" : "down";
    return ys.reduce((sum, value) => sum + value, 0) / ys.length >= staffTop + 24 ? "up" : "down";
}
function augmentationDot(x, y, style) {
    return style.dotted ? `<circle class="augmentation-dot" cx="${x}" cy="${y-3}" r="2.1" fill="currentColor"/>` : "";
}
function renderPitchedEvent(event, placement, clef, staffTop, voiceIndex, polyphonic, accidentalState, keyState) {
    const pitches = String(event.type) === "chord" ? event.notes : [event.pitch];
    const parsed = pitches.map(parseWrittenPitch);
    const ys = pitches.map(pitch => pitchY(pitch, clef, staffTop));
    const style = durationStyle(event.duration), direction = directionFor(ys, staffTop, voiceIndex, polyphonic);
    const sorted = parsed.map((pitch, index) => ({ pitch, y: ys[index], index })).sort((a, b) => a.y - b.y);
    const offsets = new Map();
    for (let index = 1; index < sorted.length; index += 1) {
        if (Math.abs(sorted[index].y - sorted[index - 1].y) <= ENGRAVING.halfGap + .1) {
            offsets.set(sorted[index].index, direction === "up" ? -9 : 9);
        }
    }
    const needed = parsed.map(pitch => {
        const current = accidentalState.has(pitch.letter) ? accidentalState.get(pitch.letter) : (keyState.get(pitch.letter) ?? 0);
        accidentalState.set(pitch.letter, pitch.accidental);
        return current === pitch.accidental ? null : accidentalName(pitch.accidental);
    });
    let accidentalColumn = 0;
    const accidentals = needed.map((kind, index) => {
        if (!kind) return "";
        const value = accidentalGlyph(kind, placement.x - 15 - accidentalColumn * ENGRAVING.accidentalGap, ys[index]);
        accidentalColumn += 1;
        return value;
    }).join("");
    const heads = ys.map((y, index) => `${ledgerLines(placement.x + (offsets.get(index) ?? 0), y, staffTop)}${notehead(placement.x, y, style.open, offsets.get(index) ?? 0)}`).join("");
    const stemY = direction === "up" ? Math.max(...ys) : Math.min(...ys);
    const stemX = placement.x + (direction === "up" ? Math.max(0, ...offsets.values()) : Math.min(0, ...offsets.values()));
    const dotX = placement.x + ENGRAVING.noteRx + 7 + Math.max(0, ...offsets.values());
    const pitchData = pitches.map(String).join(" ");
    const pitchAttribute = String(event.type) === "note" ? ` data-pitch="${xmlAttribute(event.pitch)}"` : "";
    return `<g class="event ${event.type}" data-node-id="${xmlAttribute(event.id)}" data-order="${placement.order}" role="img" aria-label="${xmlAttribute(semanticEvent(event))}" data-x="${placement.x}" data-offset="${event.offset}" data-duration="${xmlAttribute(event.duration)}"${pitchAttribute} data-pitches="${xmlAttribute(pitchData)}" data-visible-pitch-labels="false"${metadataAttribute(event)}>${accidentals}${heads}${stemAndFlags(stemX, stemY, direction, style)}${augmentationDot(dotX, ys[0], style)}</g>`;
}
function renderRest(event, placement, staffTop) {
    return `<g class="event rest" data-node-id="${xmlAttribute(event.id)}" data-order="${placement.order}" role="img" aria-label="${xmlAttribute(semanticEvent(event))}" data-x="${placement.x}" data-offset="${event.offset}" data-duration="${xmlAttribute(event.duration)}"${metadataAttribute(event)}>${restGlyph(placement.x, staffTop, event.duration)}</g>`;
}
function renderVoice(score, voice, placements, clef, staffTop, key, polyphonic) {
    const accidentalState = new Map(), keyState = expectedKeyAccidentals(key);
    return `<g class="voice" data-node-id="${xmlAttribute(voice.id)}" data-index="${voice.index}" aria-label="Voice ${voice.index}"${metadataAttribute(voice)}>${placements.map(placement => {
        const event = node(score, placement.eventId);
        return String(event.type) === "rest"
            ? renderRest(event, placement, staffTop)
            : renderPitchedEvent(event, placement, clef, staffTop, voice.index, polyphonic, accidentalState, keyState);
    }).join("")}</g>`;
}
function renderMeasure(score, layoutMeasure, system, index, staffTop, showMeter) {
    const measure = node(score, layoutMeasure.id), part = node(score, system.partId), key = measure.keySignature;
    const byVoice = new Map();
    for (const placement of layoutMeasure.eventPlacements) {
        const list = byVoice.get(placement.voiceId) ?? [];
        list.push(placement);
        byVoice.set(placement.voiceId, list);
    }
    const measureVoices = children(score, measure, "voice").sort((a, b) => a.index - b.index || String(a.id).localeCompare(String(b.id)));
    const voices = measureVoices
        .map(voice => renderVoice(score, voice, byVoice.get(String(voice.id)) ?? [], part.clef, staffTop, key, measureVoices.length > 1)).join("");
    const end = layoutMeasure.x + layoutMeasure.width;
    const header = index === 0
        ? `${clefGlyph(part.clef, layoutMeasure.x + 10, staffTop)}${keySignatureGlyph(key, part.clef, layoutMeasure.x + 55, staffTop)}${showMeter ? timeSignatureGlyph(measure, layoutMeasure.x + 55 + Math.abs(key?.accidentals ?? 0) * 11 + 24, staffTop) : ""}`
        : "";
    return `<g class="measure" role="group" aria-label="Measure ${measure.number}, ${measure.value.beats} over ${measure.value.beatUnit}, ${key ? `${key.tonic} ${key.mode} key` : "no key signature"}" data-node-id="${xmlAttribute(measure.id)}" data-number="${measure.number}" data-beats="${measure.value.beats}" data-beat-unit="${measure.value.beatUnit}" data-key-tonic="${xmlAttribute(key?.tonic ?? "")}" data-key-mode="${xmlAttribute(key?.mode ?? "none")}" data-key-accidentals="${key?.accidentals ?? 0}" data-layout-width="${layoutMeasure.width}" data-overflow="${layoutMeasure.overflow}"${metadataAttribute(measure)}>${header}${voices}<line class="barline" x1="${end}" x2="${end}" y1="${staffTop}" y2="${staffTop+ENGRAVING.lineGap*4}" stroke="currentColor" stroke-width="1.6"/></g>`;
}
function renderSystem(score, system) {
    const part = node(score, system.partId), staffTop = system.y + 34;
    const partMeasures = children(score, part, "measure").sort((a,b)=>a.number-b.number||String(a.id).localeCompare(String(b.id)));
    const firstMeasure = node(score, system.measures[0].id), measureIndex = partMeasures.findIndex(value=>String(value.id)===String(firstMeasure.id));
    const previous = measureIndex > 0 ? partMeasures[measureIndex-1] : null;
    const showMeter = !previous || previous.value.beats !== firstMeasure.value.beats || previous.value.beatUnit !== firstMeasure.value.beatUnit;
    const start = system.measures[0].x, end = system.measures.at(-1).x + system.measures.at(-1).width;
    const lines = Array.from({ length: 5 }, (_, index) => {
        const y = staffTop + index * ENGRAVING.lineGap;
        return `<line class="staff-line" data-staff-line="${index+1}" x1="${start}" x2="${end}" y1="${y}" y2="${y}" stroke="currentColor" stroke-width="${ENGRAVING.stroke}"/>`;
    }).join("");
    return `<g class="part layout-system" role="group" aria-label="${xmlAttribute(`${part.name}, ${part.clef.type} clef`)}" data-layout-system-id="${xmlAttribute(system.id)}" data-node-id="${xmlAttribute(part.id)}" data-name="${xmlAttribute(part.name)}" data-instrument="${xmlAttribute(part.instrument)}" data-clef="${xmlAttribute(part.clef.type)}" data-clef-line="${part.clef.line}" data-clef-octave-shift="${part.clef.octaveShift}" data-overflow="${system.overflow}"${metadataAttribute(part)}><text class="part-name" x="${start}" y="${system.y+16}" font-size="12">${xmlText(part.name)}</text>${lines}<line class="barline system-start" x1="${start}" x2="${start}" y1="${staffTop}" y2="${staffTop+ENGRAVING.lineGap*4}" stroke="currentColor" stroke-width="1.6"/>${system.measures.map((measure,index) => renderMeasure(score,measure,system,index,staffTop,showMeter)).join("")}</g>`;
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
        const description = `${title}. Conventional staff notation with ${plan.systems.length} visual system${plan.systems.length === 1 ? "" : "s"}. ${[...score.nodesOfType("part")].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(part => `${part.name}, ${part.clef.type} clef`).join("; ")}.`;
        const content = plan.systems.map(system => renderSystem(score, system)).join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${xmlAttribute(titleId)} ${xmlAttribute(descriptionId)}" data-layout-profile="${xmlAttribute(plan.metadata.profileId)}" data-available-width="${plan.metadata.availableWidth}" data-natural-width="${plan.metadata.naturalWidth}" data-layout-metadata="${xmlAttribute(metadataText(plan.metadata))}" data-engraving-glyphs="renderer-owned-svg"><title id="${xmlAttribute(titleId)}">${xmlText(title)}</title><desc id="${xmlAttribute(descriptionId)}">${xmlText(description)}</desc><metadata>${xmlText(metadataText(metadata))}</metadata><g class="score" data-node-id="${xmlAttribute(score.score.id)}"${metadataAttribute(score.score)}><text class="score-title" x="24" y="26" font-size="16" font-weight="600">${xmlText(title)}</text>${content}</g></svg>`;
    }
}
export default SvgScoreRenderer;
