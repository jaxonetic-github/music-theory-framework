import { ValidationError } from "../../Foundation/index.js";
import { ScoreGraph } from "../../Notation/index.js";
import { PlaybackEvent } from "../PlaybackEvent.js";
import { PlaybackPlan } from "../PlaybackPlan.js";
import { PlaybackRequest } from "../PlaybackRequest.js";
import { PlaybackStrategy } from "./PlaybackStrategy.js";

const maximum = BigInt(Number.MAX_SAFE_INTEGER);

function gcd(left, right) {
    while (right !== 0n) [left, right] = [right, left % right];
    return left < 0n ? -left : left;
}

function lcm(left, right) {
    const value = left / gcd(left, right) * right;
    if (value < 1n || value > maximum) throw new ValidationError("Playback timing resolution exceeds the safe integer range.");
    return value;
}

function safeDuration(duration) {
    if (!Number.isSafeInteger(duration.numerator) || !Number.isSafeInteger(duration.denominator)) {
        throw new ValidationError(`Duration ${duration} exceeds the safe integer range.`);
    }
    return { numerator: BigInt(duration.numerator), denominator: BigInt(duration.denominator) };
}

function requiredResolution(duration) {
    const { numerator, denominator } = safeDuration(duration);
    return denominator / gcd(denominator, 4n * numerator);
}

function deriveResolution(events, requested) {
    const resolution = requested === null
        ? events.reduce((value, event) => lcm(value, requiredResolution(event.duration)), 1n)
        : BigInt(requested);
    for (const event of events) durationTicks(event.duration, resolution);
    return resolution;
}

function durationTicks(duration, resolution) {
    const { numerator, denominator } = safeDuration(duration);
    const scaled = numerator * 4n * resolution;
    if (scaled % denominator !== 0n) {
        throw new ValidationError(`Duration ${duration} cannot be represented exactly at resolution ${resolution}.`);
    }
    const ticks = scaled / denominator;
    if (ticks < 1n || ticks > maximum) throw new ValidationError(`Duration ${duration} exceeds the safe playback tick range.`);
    return ticks;
}

function addTicks(left, right) {
    const value = left + right;
    if (value > maximum) throw new ValidationError("Playback schedule exceeds the safe integer tick range.");
    return value;
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
    const ids = new Set(events.map(event => String(event.id)));
    const successors = new Map(events.map(event => [String(event.id), []]));
    const indegree = new Map(events.map(event => [String(event.id), 0]));
    for (const edge of score.edges) {
        if (String(edge.type) !== "next" || !ids.has(String(edge.from)) || !ids.has(String(edge.to))) continue;
        successors.get(String(edge.from)).push(String(edge.to));
        indegree.set(String(edge.to), indegree.get(String(edge.to)) + 1);
    }
    for (const values of successors.values()) values.sort();
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

function unique(values, message) {
    if (new Set(values).size !== values.length) throw new ValidationError(message);
}

function compareScheduled(left, right) {
    return Number(left.startTick - right.startTick)
        || left.partId.localeCompare(right.partId)
        || left.measureNumber - right.measureNumber
        || left.measureId.localeCompare(right.measureId)
        || left.voiceIndex - right.voiceIndex
        || left.voiceId.localeCompare(right.voiceId)
        || left.eventOrder - right.eventOrder
        || left.sourceEventId.localeCompare(right.sourceEventId)
        || (left.chordIndex ?? -1) - (right.chordIndex ?? -1);
}

export class ScorePlaybackPlanner extends PlaybackStrategy {
    constructor({ pluginId = "core.playback.score" } = {}) {
        super({ id: "score", pluginId });
    }

    supports(score) { return score instanceof ScoreGraph; }

    plan(score, request = new PlaybackRequest()) {
        if (!(score instanceof ScoreGraph)) throw new ValidationError("ScorePlaybackPlanner.plan() requires a ScoreGraph.");
        const normalizedRequest = PlaybackRequest.from(request);
        const allScoreEvents = score.nodes.filter(node => ["note", "rest", "chord"].includes(String(node.type)));
        const resolution = deriveResolution(allScoreEvents, normalizedRequest.resolution);
        const scheduled = [];
        let totalTicks = 0n;
        const parts = children(score, score.score, "part").sort(compareIds);

        for (const part of parts) {
            let partCursor = 0n;
            const measures = children(score, part, "measure")
                .sort((left, right) => left.number - right.number || compareIds(left, right));
            unique(measures.map(measure => measure.number), `Part "${part.id}" contains duplicate measure numbers.`);
            for (const measure of measures) {
                const voices = children(score, measure, "voice")
                    .sort((left, right) => left.index - right.index || compareIds(left, right));
                unique(voices.map(voice => voice.index), `Measure "${measure.id}" contains duplicate voice indices.`);
                let measureTicks = 0n;
                for (const voice of voices) {
                    let voiceCursor = partCursor;
                    const events = orderedEvents(score, voice);
                    events.forEach((event, eventOrder) => {
                        const ticks = durationTicks(event.duration, resolution);
                        const common = {
                            startTick: voiceCursor,
                            durationTicks: ticks,
                            velocity: normalizedRequest.velocity,
                            partId: String(part.id),
                            measureId: String(measure.id),
                            measureNumber: measure.number,
                            voiceId: String(voice.id),
                            voiceIndex: voice.index,
                            sourceEventId: String(event.id),
                            eventOrder
                        };
                        if (String(event.type) === "note") scheduled.push({ ...common, note: event.pitch, chordId: null, chordIndex: null });
                        if (String(event.type) === "chord") event.notes.forEach((note, chordIndex) => scheduled.push({
                            ...common, note, chordId: String(event.id), chordIndex
                        }));
                        voiceCursor = addTicks(voiceCursor, ticks);
                    });
                    const voiceTicks = voiceCursor - partCursor;
                    if (voiceTicks > measureTicks) measureTicks = voiceTicks;
                }
                partCursor = addTicks(partCursor, measureTicks);
            }
            if (partCursor > totalTicks) totalTicks = partCursor;
        }

        scheduled.sort(compareScheduled);
        const events = scheduled.map((event, index) => new PlaybackEvent({
            ...event,
            sequence: index + 1,
            startTick: Number(event.startTick),
            durationTicks: Number(event.durationTicks)
        }));
        return new PlaybackPlan({
            request: normalizedRequest,
            resolution: Number(resolution),
            events,
            totalTicks: Number(totalTicks),
            metadata: {
                pluginId: String(this.pluginId),
                strategyId: String(this.id),
                scoreId: String(score.score.id),
                offsetMeaning: "deterministic-order-only"
            }
        });
    }
}

export default ScorePlaybackPlanner;
