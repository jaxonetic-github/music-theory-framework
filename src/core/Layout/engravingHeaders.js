function keyIdentity(key) {
    return key ? `${key.tonic}:${key.mode}:${key.accidentals}` : "none:0";
}

function meterIdentity(measure) {
    return `${measure.value.beats}/${measure.value.beatUnit}`;
}

const sharpOrder = Object.freeze(["F", "C", "G", "D", "A", "E", "B"]);
const flatOrder = Object.freeze(["B", "E", "A", "D", "G", "C", "F"]);

function signatureEntries(key) {
    const accidentals = key?.accidentals ?? 0;
    const alteration = accidentals < 0 ? -1 : 1;
    const order = accidentals < 0 ? flatOrder : sharpOrder;
    return Object.freeze(order.slice(0, Math.abs(accidentals)).map(step => Object.freeze({ step, alteration })));
}

export function keySignatureTransition(previousKey, nextKey, systemStart = false) {
    const previous = systemStart ? Object.freeze([]) : signatureEntries(previousKey);
    const next = signatureEntries(nextKey);
    const nextByStep = new Map(next.map(entry => [entry.step, entry.alteration]));
    const cancellations = Object.freeze(previous.filter(entry => nextByStep.get(entry.step) !== entry.alteration));
    return Object.freeze({
        cancellations,
        next,
        cancellationCount: cancellations.length,
        keyGlyphCount: next.length
    });
}

export function keySignatureGlyphCount(key) {
    return Math.abs(key?.accidentals ?? 0);
}

export function engravingHeader(measure, previousMeasure, profile, systemStart = false) {
    const keyChanged = !previousMeasure || keyIdentity(measure.keySignature) !== keyIdentity(previousMeasure.keySignature);
    const meterChanged = !previousMeasure || meterIdentity(measure) !== meterIdentity(previousMeasure);
    const showClef = systemStart;
    const showKey = systemStart || keyChanged;
    const showMeter = systemStart || meterChanged;
    const keyTransition = keySignatureTransition(previousMeasure?.keySignature, measure.keySignature, systemStart);
    const cancellationCount = showKey ? keyTransition.cancellationCount : 0;
    const keyGlyphCount = showKey ? keyTransition.keyGlyphCount : 0;
    const keyWidth = showKey && (cancellationCount || keyGlyphCount)
        ? (cancellationCount + keyGlyphCount) * 11 + 8
        : 0;
    const width = (showClef ? profile.clefWidth : 0) + keyWidth
        + (showMeter ? profile.timeSignatureWidth : 0)
        + (showClef || showKey || showMeter ? profile.measurePadding : 0);
    return Object.freeze({
        showClef, showKey, showMeter, keyChanged, meterChanged,
        cancellationCount, keyGlyphCount, keyWidth, width, keyTransition
    });
}
