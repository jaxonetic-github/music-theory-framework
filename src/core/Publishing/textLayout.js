import { ValidationError } from "../Foundation/index.js";

export const PUBLICATION_TYPOGRAPHY = Object.freeze({
    title: Object.freeze({ fontSize: 2200, lineHeight: 2800, weight: 700 }),
    subtitle: Object.freeze({ fontSize: 1200, lineHeight: 1600, weight: 400 }),
    instructions: Object.freeze({ fontSize: 1000, lineHeight: 1500, weight: 400 }),
    "curriculum-heading": Object.freeze({ fontSize: 1800, lineHeight: 2300, weight: 700 }),
    "unit-heading": Object.freeze({ fontSize: 1700, lineHeight: 2200, weight: 700 }),
    "lesson-heading": Object.freeze({ fontSize: 1600, lineHeight: 2100, weight: 700 }),
    "section-heading": Object.freeze({ fontSize: 1600, lineHeight: 2100, weight: 700 }),
    "item-heading": Object.freeze({ fontSize: 1300, lineHeight: 1800, weight: 600 }),
    "semantic-summary": Object.freeze({ fontSize: 1000, lineHeight: 1500, weight: 400 }),
    header: Object.freeze({ fontSize: 850, lineHeight: 1000, weight: 400 }),
    footer: Object.freeze({ fontSize: 800, lineHeight: 900, weight: 400 }),
    "page-number": Object.freeze({ fontSize: 800, lineHeight: 900, weight: 400 })
});

function sourceIdentity(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `text-${hash.toString(16).padStart(8, "0")}`;
}

function glyphFactor(character) {
    // Canonical layout cannot depend on the host's installed sans-serif font.
    // One em is a conservative upper bound for every supported visible glyph;
    // whitespace uses half an em. This intentionally favors safe wrapping.
    return character === " " ? 50 : 100;
}

export function measurePublicationText(value, fontSize) {
    if (!Number.isSafeInteger(fontSize) || fontSize < 1) throw new ValidationError("Publication text fontSize must be a positive safe integer.");
    return [...String(value)].reduce((width, character) => width + Math.ceil(fontSize * glyphFactor(character) / 100), 0);
}

function splitToken(token, availableWidth, fontSize) {
    const pieces = [];
    let current = "";
    for (const character of [...token]) {
        const candidate = current + character;
        if (current && measurePublicationText(candidate, fontSize) > availableWidth) {
            pieces.push(current);
            current = character;
        } else current = candidate;
        if (measurePublicationText(current, fontSize) > availableWidth) {
            throw new ValidationError("Publication text contains a glyph wider than the available line width.");
        }
    }
    if (current) pieces.push(current);
    return pieces;
}

export function layoutPublicationText({ text, availableWidth, typography, category = "instructions" } = {}) {
    const sourceText = String(text ?? "");
    if (!Number.isSafeInteger(availableWidth) || availableWidth < 1) throw new ValidationError("Publication text availableWidth must be a positive safe integer.");
    const metrics = typography ?? PUBLICATION_TYPOGRAPHY[category];
    if (!metrics || !Number.isSafeInteger(metrics.fontSize) || !Number.isSafeInteger(metrics.lineHeight) || metrics.fontSize < 1 || metrics.lineHeight < metrics.fontSize) {
        throw new ValidationError(`Publication typography for "${category}" is invalid.`);
    }
    const identity = sourceIdentity(sourceText), lineValues = [];
    const paragraphs = sourceText.replace(/\r\n?/g, "\n").split("\n");
    for (const raw of paragraphs) {
        const normalized = raw.trim().replace(/[^\S\n]+/gu, " ");
        if (!normalized) {
            lineValues.push("");
            continue;
        }
        let current = "";
        const tokens = normalized.split(" ").flatMap(token => measurePublicationText(token, metrics.fontSize) <= availableWidth
            ? [token] : splitToken(token, availableWidth, metrics.fontSize));
        for (const token of tokens) {
            const candidate = current ? `${current} ${token}` : token;
            if (current && measurePublicationText(candidate, metrics.fontSize) > availableWidth) {
                lineValues.push(current);
                current = token;
            } else current = candidate;
        }
        if (current) lineValues.push(current);
    }
    if (!lineValues.length) lineValues.push("");
    const lines = Object.freeze(lineValues.map((lineText, index) => Object.freeze({
        text: lineText,
        width: measurePublicationText(lineText, metrics.fontSize),
        index: index + 1,
        yOffset: index * metrics.lineHeight,
        lineHeight: metrics.lineHeight,
        sourceTextIdentity: identity
    })));
    if (lines.some(line => line.width > availableWidth)) throw new ValidationError("Publication text wrapping produced an overflowing line.");
    return Object.freeze({
        sourceText,
        sourceTextIdentity: identity,
        category,
        fontSize: metrics.fontSize,
        lineHeight: metrics.lineHeight,
        weight: metrics.weight,
        availableWidth,
        lines,
        lineCount: lines.length,
        height: lines.length * metrics.lineHeight
    });
}
