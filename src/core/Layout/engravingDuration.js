import { ValidationError } from "../Foundation/index.js";

const names = Object.freeze(["whole", "half", "quarter", "eighth"]);
function gcd(left, right) { while (right) { const next = left % right; left = right; right = next; } return left; }
function bigGcd(left, right) { while (right) { const next = left % right; left = right; right = next; } return left; }
function kind(power) { return names[power] ?? `${2 ** power}th`; }
function style(basePower, dotCount = 0, ratio = null) {
    const flags = Math.max(0, basePower - 2);
    return Object.freeze({
        kind: kind(basePower),
        baseDenominator: 2 ** basePower,
        open: basePower <= 1,
        stem: basePower > 0,
        flags,
        dotCount,
        dotted: dotCount > 0,
        ratio: ratio ? Object.freeze(ratio) : null
    });
}

export function engravingDurationStyle(duration) {
    const numerator = Number(duration?.numerator), denominator = Number(duration?.denominator);
    if (!Number.isSafeInteger(numerator) || numerator <= 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
        throw new ValidationError("Engraving duration requires positive safe-integer numerator and denominator values.");
    }
    const divisor = gcd(numerator, denominator), normalizedNumerator = numerator / divisor, normalizedDenominator = denominator / divisor;
    const leftNumerator = BigInt(normalizedNumerator), leftDenominator = BigInt(normalizedDenominator);
    for (let basePower = 0; basePower <= 12; basePower += 1) {
        for (let dotCount = 0; dotCount <= 3; dotCount += 1) {
            const valueNumerator = (1n << BigInt(dotCount + 1)) - 1n;
            const valueDenominator = 1n << BigInt(basePower + dotCount);
            if (leftNumerator * valueDenominator !== leftDenominator * valueNumerator) continue;
            return style(basePower, dotCount);
        }
    }
    let basePower = 0;
    while (basePower < 12
        && leftNumerator * (1n << BigInt(basePower)) < leftDenominator) basePower += 1;
    if (basePower && leftNumerator * (1n << BigInt(basePower)) > leftDenominator) basePower -= 1;
    const baseDenominator = 1n << BigInt(basePower);
    const ratioNumerator = BigInt(normalizedNumerator) * baseDenominator;
    const ratioDenominator = BigInt(normalizedDenominator);
    const ratioDivisor = bigGcd(ratioNumerator, ratioDenominator);
    return style(basePower, 0, {
        numerator: (ratioNumerator / ratioDivisor).toString(),
        denominator: (ratioDenominator / ratioDivisor).toString()
    });
}
