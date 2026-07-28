import { ValidationError } from "../Foundation/index.js";

const letters = "CDEFGAB";
export const chordHeadDisplacement = 9;

function writtenPosition(value) {
    const match = /^([A-G])(?:#{1,2}|b{1,2}|x)?(-?\d+)$/.exec(String(value));
    if (!match) throw new ValidationError(`Unsupported written chord pitch "${String(value)}".`);
    return Number(match[2]) * 7 + letters.indexOf(match[1]);
}

export function chordHeadGeometry(pitches, direction = "up") {
    if (!Array.isArray(pitches) || !pitches.length || !["up", "down"].includes(direction)) {
        throw new ValidationError("Chord head geometry requires pitches and a stem direction.");
    }
    const sorted = pitches.map((pitch, index) =>
        ({ pitch: String(pitch), index, position: writtenPosition(pitch) }))
        .sort((a, b) => a.position - b.position || a.pitch.localeCompare(b.pitch) || a.index - b.index);
    const offsets = Array(pitches.length).fill(0);
    let chainIndex = 0;
    for (let index = 1; index < sorted.length; index += 1) {
        chainIndex = sorted[index].position - sorted[index - 1].position === 1 ? chainIndex + 1 : 0;
        if (chainIndex % 2) offsets[sorted[index].index] = direction === "up" ? -chordHeadDisplacement : chordHeadDisplacement;
    }
    return Object.freeze({
        offsets: Object.freeze(offsets),
        sorted: Object.freeze(sorted.map(value => Object.freeze({ ...value }))),
        hasAdjacentSecond: sorted.some((value, index) => index > 0 && value.position - sorted[index - 1].position === 1),
        left: Math.max(0, ...offsets.map(value => -value)),
        right: Math.max(0, ...offsets)
    });
}
