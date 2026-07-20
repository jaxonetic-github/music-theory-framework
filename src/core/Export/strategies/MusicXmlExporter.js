import { ValidationError } from "../../Foundation/index.js";
import { ScoreGraph } from "../../Notation/index.js";
import { ExportResult } from "../ExportResult.js";
import { ExporterStrategy } from "./ExporterStrategy.js";
import { metadataText, xmlAttribute, xmlText } from "./xml.js";

function greatestCommonDivisor(left, right) {
    while (right) [left, right] = [right, left % right];
    return Math.abs(left);
}

function greatestCommonDivisorBigInt(left, right) {
    while (right !== 0n) [left, right] = [right, left % right];
    return left < 0n ? -left : left;
}

function leastCommonMultiple(left, right) {
    const result = Math.abs(left / greatestCommonDivisor(left, right) * right);
    if (!Number.isSafeInteger(result) || result < 1) {
        throw new ValidationError("MusicXML divisions exceed the supported integer range.");
    }
    return result;
}

function compareIds(left, right) {
    const leftId = String(left.id);
    const rightId = String(right.id);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function children(score, parent, type) {
    const ids = new Set(score.edges
        .filter(edge => String(edge.type) === "contains" && String(edge.from) === String(parent.id))
        .map(edge => String(edge.to)));
    return score.nodes.filter(node => ids.has(String(node.id)) && (!type || String(node.type) === type));
}

function orderedEvents(score, voice) {
    const events = children(score, voice).filter(node => ["note", "rest", "chord"].includes(String(node.type)));
    const eventIds = new Set(events.map(event => String(event.id)));
    const successors = new Map(events.map(event => [String(event.id), []]));
    const indegree = new Map(events.map(event => [String(event.id), 0]));
    for (const edge of score.edges) {
        if (String(edge.type) !== "next" || !eventIds.has(String(edge.from)) || !eventIds.has(String(edge.to))) continue;
        successors.get(String(edge.from)).push(String(edge.to));
        indegree.set(String(edge.to), indegree.get(String(edge.to)) + 1);
    }
    const compare = (left, right) => left.offset - right.offset || compareIds(left, right);
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

function divisionsFor(events) {
    return events.reduce((divisions, event) => {
        const { numerator, denominator } = event.duration;
        if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
            throw new ValidationError(`Duration ${event.duration} exceeds the supported integer range.`);
        }
        const numeratorInteger = BigInt(numerator);
        const denominatorInteger = BigInt(denominator);
        const requiredInteger = denominatorInteger
            / greatestCommonDivisorBigInt(denominatorInteger, 4n * numeratorInteger);
        if (requiredInteger > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new ValidationError("MusicXML divisions exceed the supported integer range.");
        }
        const required = Number(requiredInteger);
        return leastCommonMultiple(divisions, required);
    }, 1);
}

function durationUnits(duration, divisions) {
    const scaled = BigInt(duration.numerator) * 4n * BigInt(divisions);
    const denominator = BigInt(duration.denominator);
    if (scaled % denominator !== 0n) {
        throw new ValidationError(`Duration ${duration} cannot be represented exactly with ${divisions} divisions.`);
    }
    const units = scaled / denominator;
    if (units > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new ValidationError(`Duration ${duration} exceeds the supported MusicXML integer range.`);
    }
    return Number(units);
}

const baseTypes = Object.freeze([
    { numerator: 1, denominator: 1, type: "whole" },
    { numerator: 1, denominator: 2, type: "half" },
    { numerator: 1, denominator: 4, type: "quarter" },
    { numerator: 1, denominator: 8, type: "eighth" },
    { numerator: 1, denominator: 16, type: "16th" },
    { numerator: 1, denominator: 32, type: "32nd" },
    { numerator: 1, denominator: 64, type: "64th" }
]);

function notationType(duration) {
    for (const base of baseTypes) {
        if (duration.numerator * base.denominator === base.numerator * duration.denominator) {
            return { type: base.type, dotted: false };
        }
        if (duration.numerator * 2 * base.denominator === 3 * base.numerator * duration.denominator) {
            return { type: base.type, dotted: true };
        }
    }
    return null;
}

function pitchXml(note) {
    const match = /^([A-G])([#b]*)$/.exec(String(note.pitchClass));
    if (!match) throw new ValidationError(`Unsupported written pitch spelling: "${note.pitchClass}".`);
    const alter = [...match[2]].reduce((total, accidental) => total + (accidental === "#" ? 1 : -1), 0);
    return `<pitch><step>${match[1]}</step>${alter === 0 ? "" : `<alter>${alter}</alter>`}<octave>${note.octave}</octave></pitch>`;
}

function accidentalXml(note) {
    const spelling = String(note.pitchClass);
    if (spelling.endsWith("##")) return "<accidental>double-sharp</accidental>";
    if (spelling.endsWith("bb")) return "<accidental>flat-flat</accidental>";
    if (spelling.endsWith("#")) return "<accidental>sharp</accidental>";
    if (spelling.endsWith("b")) return "<accidental>flat</accidental>";
    return "";
}

function notationXml(duration) {
    const notation = notationType(duration);
    return notation ? `<type>${notation.type}</type>${notation.dotted ? "<dot/>" : ""}` : "";
}

function pitchedNoteXml(note, duration, divisions, voice, chord = false) {
    return `<note>${chord ? "<chord/>" : ""}${pitchXml(note)}<duration>${durationUnits(duration, divisions)}</duration><voice>${voice}</voice>${notationXml(duration)}${accidentalXml(note)}</note>`;
}

function eventXml(event, divisions, voice) {
    if (String(event.type) === "rest") {
        return `<note><rest/><duration>${durationUnits(event.duration, divisions)}</duration><voice>${voice}</voice>${notationXml(event.duration)}</note>`;
    }
    if (String(event.type) === "chord") {
        return event.notes.map((note, index) => pitchedNoteXml(note, event.duration, divisions, voice, index > 0)).join("");
    }
    return pitchedNoteXml(event.pitch, event.duration, divisions, voice);
}

const clefSigns = Object.freeze({ treble: "G", bass: "F", alto: "C", tenor: "C", percussion: "percussion" });

function attributesXml(part, measure, divisions) {
    const clef = part.clef;
    const sign = clefSigns[clef.type];
    if (!sign) throw new ValidationError(`Unsupported MusicXML clef: "${clef.type}".`);
    const octaveChange = clef.octaveShift === 0 ? "" : `<clef-octave-change>${clef.octaveShift}</clef-octave-change>`;
    const key = measure.keySignature ? `<key><fifths>${measure.keySignature.accidentals}</fifths><mode>${xmlText(measure.keySignature.mode)}</mode></key>` : "";
    return `<attributes><divisions>${divisions}</divisions>${key}<time><beats>${measure.value.beats}</beats><beat-type>${measure.value.beatUnit}</beat-type></time><clef><sign>${sign}</sign><line>${clef.line}</line>${octaveChange}</clef></attributes>`;
}

function unique(values, message) {
    if (new Set(values).size !== values.length) throw new ValidationError(message);
}

function measureXml(score, part, measure) {
    const voices = children(score, measure, "voice")
        .sort((left, right) => left.index - right.index || compareIds(left, right));
    if (voices.length === 0) throw new ValidationError(`Measure ${measure.number} must contain at least one voice.`);
    unique(voices.map(voice => voice.index), `Measure ${measure.number} contains duplicate voice indices.`);
    const eventsByVoice = voices.map(voice => orderedEvents(score, voice));
    const divisions = divisionsFor(eventsByVoice.flat());
    const content = voices.map((voice, index) => {
        const events = eventsByVoice[index];
        const previousDuration = index === 0 ? 0 : eventsByVoice[index - 1]
            .reduce((total, event) => total + durationUnits(event.duration, divisions), 0);
        const backup = previousDuration === 0 ? "" : `<backup><duration>${previousDuration}</duration></backup>`;
        return `${backup}${events.map(event => eventXml(event, divisions, voice.index)).join("")}`;
    }).join("");
    return `<measure number="${measure.number}">${attributesXml(part, measure, divisions)}${content}</measure>`;
}

function partXml(score, part, index) {
    const measures = children(score, part, "measure")
        .sort((left, right) => left.number - right.number || compareIds(left, right));
    if (measures.length === 0) throw new ValidationError(`Part "${part.name}" must contain at least one measure.`);
    unique(measures.map(measure => measure.number), `Part "${part.name}" contains duplicate measure numbers.`);
    return `<part id="P${index + 1}">${measures.map(measure => measureXml(score, part, measure)).join("")}</part>`;
}

export class MusicXmlExporter extends ExporterStrategy {
    constructor({ pluginId = "core.export.musicxml" } = {}) {
        super({ id: "musicxml", pluginId, format: "musicxml", mediaType: "application/vnd.recordare.musicxml+xml" });
    }

    supports(score) { return score instanceof ScoreGraph; }

    export(score, options = {}) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("MusicXmlExporter.export() requires a ScoreGraph.");
        const parts = children(score, score.score, "part").sort(compareIds);
        if (parts.length === 0) throw new ValidationError("MusicXML export requires at least one part.");
        const metadataName = options.metadataName ?? "score-metadata";
        const metadata = options.metadata ?? score.score.metadata;
        const definitions = parts.map((part, index) => {
            const partId = `P${index + 1}`;
            return `<score-part id="${partId}"><part-name>${xmlText(part.name)}</part-name><score-instrument id="${partId}-I1"><instrument-name>${xmlText(part.instrument)}</instrument-name></score-instrument></score-part>`;
        }).join("");
        const content = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`
            + `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">`
            + `<score-partwise version="4.0"><work><work-title>${xmlText(options.title ?? score.score.title)}</work-title></work>`
            + `<identification><miscellaneous><miscellaneous-field name="${xmlAttribute(metadataName)}">${xmlText(metadataText(metadata))}</miscellaneous-field></miscellaneous></identification>`
            + `<part-list>${definitions}</part-list>${parts.map(partXml.bind(null, score)).join("")}</score-partwise>`;
        return new ExportResult({
            format: this.format,
            mediaType: this.mediaType,
            extension: options.extension ?? "musicxml",
            content
        });
    }
}

export default MusicXmlExporter;
