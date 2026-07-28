function keyIdentity(key) {
    return key ? `${key.tonic}:${key.mode}:${key.accidentals}` : "none:0";
}

function meterIdentity(measure) {
    return `${measure.value.beats}/${measure.value.beatUnit}`;
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
    const cancellationCount = showKey && !systemStart ? keySignatureGlyphCount(previousMeasure?.keySignature) : 0;
    const keyGlyphCount = showKey ? keySignatureGlyphCount(measure.keySignature) : 0;
    const keyWidth = showKey && (cancellationCount || keyGlyphCount)
        ? (cancellationCount + keyGlyphCount) * 11 + 8
        : 0;
    const width = (showClef ? profile.clefWidth : 0) + keyWidth
        + (showMeter ? profile.timeSignatureWidth : 0)
        + (showClef || showKey || showMeter ? profile.measurePadding : 0);
    return Object.freeze({
        showClef, showKey, showMeter, keyChanged, meterChanged,
        cancellationCount, keyGlyphCount, keyWidth, width
    });
}
