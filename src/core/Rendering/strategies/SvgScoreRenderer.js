import { ScoreGraph } from "../../Notation/index.js";
import { ValidationError } from "../../Foundation/index.js";
import { RendererStrategy } from "./RendererStrategy.js";
import { metadataText, xmlAttribute, xmlText } from "./svg.js";

function children(score, parent, type) {
    const ids = new Set(score.edges
        .filter(edge => String(edge.type) === "contains" && String(edge.from) === String(parent.id))
        .map(edge => String(edge.to)));
    return score.nodes.filter(node => ids.has(String(node.id)) && (!type || String(node.type) === type));
}

function compareIds(left, right) {
    const leftId = String(left.id);
    const rightId = String(right.id);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function eventOrder(score, voice) {
    const events = children(score, voice).filter(node => ["note", "rest", "chord"].includes(String(node.type)));
    const eventIds = new Set(events.map(event => String(event.id)));
    const successors = new Map(events.map(event => [String(event.id), []]));
    const indegree = new Map(events.map(event => [String(event.id), 0]));
    for (const edge of score.edges) {
        if (String(edge.type) !== "next" || !eventIds.has(String(edge.from)) || !eventIds.has(String(edge.to))) continue;
        successors.get(String(edge.from)).push(String(edge.to));
        indegree.set(String(edge.to), indegree.get(String(edge.to)) + 1);
    }
    const compare = (left, right) => left.offset - right.offset
        || compareIds(left, right);
    const available = events.filter(event => indegree.get(String(event.id)) === 0).sort(compare);
    const ordered = [];

    while (available.length) {
        const event = available.shift();
        ordered.push(event);
        for (const successor of successors.get(String(event.id))) {
            const remaining = indegree.get(successor) - 1;
            indegree.set(successor, remaining);
            if (remaining === 0) {
                available.push(score.node(successor));
                available.sort(compare);
            }
        }
    }
    if (ordered.length !== events.length) throw new ValidationError("Score event precedence constraints contain a cycle.");
    return ordered;
}

function metadataAttribute(node) {
    return ` data-metadata="${xmlAttribute(metadataText(node.metadata))}"`;
}

function renderEvent(event, order, x, y) {
    const common = `class="event ${event.type}" data-node-id="${xmlAttribute(event.id)}" data-order="${order}" data-offset="${event.offset}" data-duration="${xmlAttribute(event.duration)}" transform="translate(${x} ${y})"${metadataAttribute(event)}`;
    if (String(event.type) === "rest") {
        return `<g ${common}><rect x="0" y="-8" width="18" height="8"/><text x="9" y="18" text-anchor="middle">rest</text></g>`;
    }
    if (String(event.type) === "chord") {
        const spelling = event.notes.map(String).join(" ");
        return `<g ${common} data-pitches="${xmlAttribute(spelling)}"><circle cx="9" cy="0" r="8"/><text x="9" y="22" text-anchor="middle">${xmlText(spelling)}</text></g>`;
    }
    return `<g ${common} data-pitch="${xmlAttribute(event.pitch)}"><circle cx="9" cy="0" r="6"/><text x="9" y="22" text-anchor="middle">${xmlText(event.pitch)}</text></g>`;
}

function renderVoice(score, voice, y) {
    const events = eventOrder(score, voice);
    const content = events.map((event, index) => renderEvent(event, index + 1, 190 + index * 110, y)).join("");
    return `<g class="voice" data-node-id="${xmlAttribute(voice.id)}" data-index="${voice.index}"${metadataAttribute(voice)}>${content}</g>`;
}

function renderMeasure(score, measure, part, y) {
    const voices = children(score, measure, "voice").sort((a, b) => a.index - b.index || String(a.id).localeCompare(String(b.id)));
    const key = measure.keySignature;
    const signature = `${part.clef.type} clef, ${key.tonic} ${key.mode}, ${measure.value.beats}/${measure.value.beatUnit}`;
    return `<g class="measure" data-node-id="${xmlAttribute(measure.id)}" data-number="${measure.number}" data-beats="${measure.value.beats}" data-beat-unit="${measure.value.beatUnit}" data-key-tonic="${xmlAttribute(key.tonic)}" data-key-mode="${xmlAttribute(key.mode)}" data-key-accidentals="${key.accidentals}" transform="translate(0 ${y})"${metadataAttribute(measure)}><rect x="40" y="0" width="1120" height="110" fill="none" stroke="currentColor"/><text class="signature" x="55" y="25">${xmlText(signature)}</text>${voices.map((voice, index) => renderVoice(score, voice, 58 + index * 45)).join("")}</g>`;
}

function renderPart(score, part, y) {
    const measures = children(score, part, "measure").sort((a, b) => a.number - b.number || String(a.id).localeCompare(String(b.id)));
    const clef = part.clef;
    return `<g class="part" data-node-id="${xmlAttribute(part.id)}" data-name="${xmlAttribute(part.name)}" data-instrument="${xmlAttribute(part.instrument)}" data-clef="${xmlAttribute(clef.type)}" data-clef-line="${clef.line}" data-clef-octave-shift="${clef.octaveShift}" transform="translate(0 ${y})"${metadataAttribute(part)}><text class="part-name" x="40" y="20">${xmlText(part.name)}</text>${measures.map((measure, index) => renderMeasure(score, measure, part, 35 + index * 130)).join("")}</g>`;
}

export class SvgScoreRenderer extends RendererStrategy {
    constructor({ pluginId = "core.rendering.svg" } = {}) {
        super({ id: "svg", pluginId, format: "svg" });
    }

    supports(score) { return score instanceof ScoreGraph; }

    render(score, options = {}) {
        const parts = children(score, score.score, "part").sort(compareIds);
        const measureCount = Math.max(1, ...parts.map(part => children(score, part, "measure").length));
        const height = Number(options.height ?? Math.max(240, 90 + parts.length * (45 + measureCount * 130)));
        const width = Number(options.width ?? 1200);
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            throw new ValidationError("SVG width and height must be positive finite numbers.");
        }
        const title = options.title ?? score.score.title;
        const metadata = options.metadata ?? score.score.metadata;
        const content = parts.map((part, index) => renderPart(score, part, 55 + index * (45 + measureCount * 130))).join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="score-title"><title id="score-title">${xmlText(title)}</title><metadata>${xmlText(metadataText(metadata))}</metadata><g class="score" data-node-id="${xmlAttribute(score.score.id)}"${metadataAttribute(score.score)}><text class="score-title" x="40" y="35">${xmlText(title)}</text>${content}</g></svg>`;
    }
}

export default SvgScoreRenderer;
