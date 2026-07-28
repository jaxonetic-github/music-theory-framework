import { xmlAttribute } from "./svg.js";
import { ValidationError } from "../../Foundation/index.js";
import { engravingDurationStyle } from "../../Layout/engravingDuration.js";
import { keySignatureTransition } from "../../Layout/engravingHeaders.js";

export const ENGRAVING = Object.freeze({
    lineGap: 12, halfGap: 6, noteRx: 7, noteRy: 5, stemLength: 34,
    accidentalGap: 13, ledgerWidth: 22, stroke: 1.4
});

const letters = Object.freeze({ C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 });
const clefBottom = Object.freeze({ treble: 30, bass: 18, alto: 26, tenor: 22, percussion: 28 });
const sharpOrder = Object.freeze(["F", "C", "G", "D", "A", "E", "B"]);
const flatOrder = Object.freeze(["B", "E", "A", "D", "G", "C", "F"]);
const keyY = Object.freeze({
    treble: Object.freeze({ sharp: [0, 18, -6, 12, 30, 6, 24], flat: [24, 6, 30, 12, 36, 18, 42] }),
    bass: Object.freeze({ sharp: [12, 30, 6, 24, 42, 18, 36], flat: [36, 18, 42, 24, 48, 30, 54] }),
    alto: Object.freeze({ sharp: [18, 36, 12, 30, 6, 24, 42], flat: [42, 24, 48, 30, 12, 36, 18] }),
    tenor: Object.freeze({ sharp: [6, 24, 42, 18, 36, 12, 30], flat: [30, 12, 36, 18, 42, 24, 48] })
});

export function parseWrittenPitch(value) {
    const match = /^([A-G])((?:#{1,2}|b{1,2}|x)?)(-?\d+)$/.exec(String(value));
    if (!match) throw new TypeError(`Unsupported written pitch "${String(value)}".`);
    const accidental = match[2] === "x" ? 2 : match[2].startsWith("#") ? match[2].length : -match[2].length;
    return Object.freeze({ letter: match[1], accidental, octave: Number(match[3]), diatonic: Number(match[3]) * 7 + letters[match[1]] });
}

export function pitchY(pitch, clef, staffTop) {
    const written = parseWrittenPitch(pitch);
    const bottom = clefBottom[clef.type] ?? clefBottom.treble;
    return staffTop + ENGRAVING.lineGap * 4 - (written.diatonic - bottom) * ENGRAVING.halfGap;
}

export const durationStyle = engravingDurationStyle;

export function accidentalGlyph(kind, x, y, className = "accidental") {
    if (!["double-flat", "flat", "natural", "sharp", "double-sharp"].includes(kind)) {
        throw new ValidationError(`Unsupported engraving accidental: "${String(kind)}".`);
    }
    const common = `class="${className} accidental-${kind}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"`;
    if (kind === "sharp") return `<path ${common} d="M${x-4} ${y-13}v26M${x+4} ${y-15}v26M${x-8} ${y-5}l16-4M${x-8} ${y+5}l16-4"/>`;
    if (kind === "flat") return `<path ${common} d="M${x-3} ${y-16}v28c12-5 11-17 0-12"/>`;
    if (kind === "double-flat") return `<g class="${className} accidental-double-flat">${accidentalGlyph("flat", x-4, y, "accidental-component")}${accidentalGlyph("flat", x+4, y, "accidental-component")}</g>`;
    if (kind === "double-sharp") return `<path ${common} d="M${x-7} ${y-7}l14 14M${x+7} ${y-7}l-14 14M${x-7} ${y-7}l14 0M${x-7} ${y+7}l14 0"/>`;
    return `<path ${common} d="M${x-4} ${y-14}v25M${x+4} ${y-11}v25M${x-4} ${y-2}l8-4M${x-4} ${y+8}l8-4"/>`;
}

export function clefGlyph(clef, x, staffTop) {
    const middle = staffTop + 24, type = clef.type;
    if (type === "treble") return `<g class="clef clef-treble" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M${x+20} ${staffTop-14}c-14 17-11 34 1 43c15 11 13 29-1 34c-13 5-25-6-20-18c4-10 18-12 24-4c6 8-2 18-10 14c-9-5-4-22 3-37c8-17 10-31 4-38c-5-6-10 1-8 12c3 18 10 41 11 63c1 15-5 22-12 13"/></g>`;
    if (type === "bass") return `<g class="clef clef-bass" fill="currentColor"><path d="M${x+4} ${middle-9}c12-13 29-5 24 11c-4 13-17 21-29 24c10-7 19-14 20-24c1-9-8-12-15-6z"/><circle cx="${x+34}" cy="${middle-6}" r="2.6"/><circle cx="${x+34}" cy="${middle+6}" r="2.6"/></g>`;
    if (type === "percussion") return `<g class="clef clef-percussion" fill="none" stroke="currentColor" stroke-width="3"><path d="M${x+8} ${middle-12}l18 24M${x+26} ${middle-12}l-18 24"/></g>`;
    const lineY = staffTop + (5 - clef.line) * ENGRAVING.lineGap;
    return `<g class="clef clef-${xmlAttribute(type)}" fill="none" stroke="currentColor" stroke-width="2"><path d="M${x+5} ${lineY-20}v40h11l-7-8l7-8h-11M${x+31} ${lineY-20}v40h-11l7-8l-7-8h11"/></g>`;
}

export function keySignatureGlyph(key, clef, x, staffTop, previousKey = null, transition = keySignatureTransition(previousKey, key, !previousKey)) {
    const previousCount = transition.cancellationCount;
    const currentCount = transition.keyGlyphCount;
    if (!previousCount && !currentCount) return "";
    const previousSharp = (previousKey?.accidentals ?? 0) > 0, previousOrder = previousSharp ? sharpOrder : flatOrder;
    const previousPositions = (keyY[clef.type] ?? keyY.treble)[previousSharp ? "sharp" : "flat"];
    const cancellations = transition.cancellations.map((entry, index) => {
        const position = previousOrder.indexOf(entry.step);
        return accidentalGlyph("natural", x + index * 11, staffTop + previousPositions[position], `key-accidental key-cancellation key-${entry.step}`);
    }).join("");
    const sharp = (key?.accidentals ?? 0) > 0, order = sharp ? sharpOrder : flatOrder;
    const positions = (keyY[clef.type] ?? keyY.treble)[sharp ? "sharp" : "flat"];
    const offset = previousCount * 11;
    const current = transition.next.map((entry, index) =>
        accidentalGlyph(entry.alteration > 0 ? "sharp" : "flat", x + offset + index * 11, staffTop + positions[order.indexOf(entry.step)], `key-accidental key-${entry.step}`)).join("");
    const label = key ? `${key.tonic} ${key.mode} key signature` : "no key signature";
    return `<g class="key-signature" aria-label="${xmlAttribute(label)}">${cancellations}${current}</g>`;
}

export function timeSignatureGlyph(measure, x, staffTop) {
    const paths = {
        0: "M2 1C-1 4-1 16 2 19C8 22 11 17 11 10C11 3 8-2 2 1Z",
        1: "M2 5L6 1V20M2 20H10",
        2: "M1 5C3-1 11 0 11 6C11 10 5 14 1 20H12",
        3: "M1 2C9-2 13 4 7 10C14 13 11 22 1 19",
        4: "M10 20V1L0 14H13",
        5: "M11 1H2L1 10C12 7 14 20 2 20C1 20 0 19 0 19",
        6: "M11 2C3-2 0 7 1 14C2 23 13 21 12 14C11 8 4 8 1 13",
        7: "M0 1H13L5 20",
        8: "M6 10C-2 8 0 0 6 1C13 1 14 9 6 10C-2 11-1 21 6 20C14 20 14 11 6 10Z",
        9: "M1 19C9 23 12 13 11 6C10-3-1 0 0 7C1 13 8 13 11 8"
    };
    const number = (value, y) => {
        const digits = String(value).split(""), total = digits.length * 15 - 2;
        return `<g class="meter-number" transform="translate(${x-total/2} ${y})" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${digits.map((digit,index)=>`<path d="${paths[digit]}" transform="translate(${index*15} 0)"/>`).join("")}</g>`;
    };
    return `<g class="time-signature" aria-label="${measure.value.beats} over ${measure.value.beatUnit} time">${number(measure.value.beats, staffTop+2)}${number(measure.value.beatUnit, staffTop+25)}</g>`;
}

export function ledgerLines(x, y, staffTop) {
    const top = staffTop, bottom = staffTop + 48, values = [];
    for (let line = bottom + ENGRAVING.lineGap; line <= y + 1; line += ENGRAVING.lineGap) values.push(line);
    for (let line = top - ENGRAVING.lineGap; line >= y - 1; line -= ENGRAVING.lineGap) values.push(line);
    return values.map(line => `<line class="ledger-line" x1="${x-ENGRAVING.ledgerWidth/2}" x2="${x+ENGRAVING.ledgerWidth/2}" y1="${line}" y2="${line}" stroke="currentColor" stroke-width="${ENGRAVING.stroke}"/>`).join("");
}

export function notehead(x, y, open, offset = 0) {
    return `<ellipse class="notehead${open?" open":""}" cx="${x+offset}" cy="${y}" rx="${ENGRAVING.noteRx}" ry="${ENGRAVING.noteRy}" transform="rotate(-18 ${x+offset} ${y})" fill="${open?"white":"currentColor"}" stroke="currentColor" stroke-width="1.5"/>`;
}

export function stemAndFlags(x, y, direction, style) {
    if (!style.stem) return "";
    const side = direction === "up" ? ENGRAVING.noteRx - 1 : -ENGRAVING.noteRx + 1;
    const end = y + (direction === "up" ? -ENGRAVING.stemLength : ENGRAVING.stemLength);
    let result = `<line class="stem stem-${direction}" x1="${x+side}" x2="${x+side}" y1="${y}" y2="${end}" stroke="currentColor" stroke-width="1.5"/>`;
    for (let index = 0; index < style.flags; index += 1) {
        const fy = end + (direction === "up" ? index * 7 : -index * 7);
        const dy = direction === "up" ? 18 : -18;
        result += `<path class="flag flag-${direction}" d="M${x+side} ${fy}c${direction==="up"?12:-12} ${direction==="up"?5:-5} ${direction==="up"?13:-13} ${dy} ${direction==="up"?4:-4} ${dy+5}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
    }
    return result;
}

export function durationRatioGlyph(x, y, style) {
    if (!style.ratio) return "";
    const segments = Object.freeze({
        0: "ab cdef".replace(" ", ""), 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg",
        5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg"
    });
    const paths = Object.freeze({
        a: "M1 0h6", b: "M8 1v5", c: "M8 8v5", d: "M1 14h6",
        e: "M0 8v5", f: "M0 1v5", g: "M1 7h6"
    });
    const digits = String(style.ratio.denominator), start = x - digits.length * 5;
    const number = [...digits].map((digit, index) =>
        [...segments[digit]].map(segment => `<path d="${paths[segment]}" transform="translate(${start + index * 11} ${y})"/>`).join("")).join("");
    return `<g class="duration-ratio" role="img" aria-label="${style.ratio.numerator} to ${style.ratio.denominator} exact duration ratio" data-duration-ratio="${style.ratio.numerator}:${style.ratio.denominator}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path class="duration-ratio-bracket" d="M${x-12} ${y+18}v3h24v-3"/>${number}</g>`;
}

export function restGlyph(x, staffTop, duration) {
    const style = durationStyle(duration), middle = staffTop + 24;
    let glyph;
    if (style.kind === "whole") glyph = `<path class="rest-body" d="M${x-8} ${staffTop+18}h16v7h-16z" fill="currentColor"/>`;
    else if (style.kind === "half") glyph = `<path class="rest-body" d="M${x-8} ${staffTop+29}h16v-7h-16z" fill="currentColor"/>`;
    else if (style.kind === "quarter") glyph = `<path class="rest-body" d="M${x+3} ${middle-19}l-8 13l9 9l-8 12c9-3 13 5 7 12c3-9-4-8-9-4l7-13l-9-9l8-14z" fill="currentColor"/>`;
    else {
        const top = middle - 15;
        glyph = `<path class="rest-stem" d="M${x-3} ${top}v${28 + (style.flags - 1) * 7}" stroke="currentColor" stroke-width="2"/>`;
        glyph += Array.from({ length: style.flags }, (_, index) => {
            const y = top + index * 7;
            return `<path class="rest-hook" data-hook="${index+1}" d="M${x-3} ${y}c13 2 12 12 3 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle class="rest-hook-head" cx="${x-6}" cy="${y+1}" r="3.8" fill="currentColor"/>`;
        }).join("");
    }
    const dotX = x + 13;
    const dots = Array.from({ length: style.dotCount }, (_, index) =>
        `<circle class="rest-augmentation-dot" data-dot="${index+1}" cx="${dotX + index * 7}" cy="${middle-3}" r="2.1" fill="currentColor"/>`).join("");
    return `<g class="rest rest-${style.kind}" data-rest-kind="${style.kind}" data-rest-flags="${style.flags}" data-rest-dots="${style.dotCount}">${glyph}${dots}${durationRatioGlyph(x, staffTop-24, style)}</g>`;
}

export function expectedKeyAccidentals(key) {
    const map = new Map();
    if (!key?.accidentals) return map;
    const sharp = key.accidentals > 0, order = sharp ? sharpOrder : flatOrder;
    for (const letter of order.slice(0, Math.abs(key.accidentals))) map.set(letter, sharp ? 1 : -1);
    return map;
}
