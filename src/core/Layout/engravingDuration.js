import { ValidationError } from "../Foundation/index.js";

const kinds = Object.freeze(["whole", "half", "quarter", "eighth", "16th", "32nd", "64th"]);

export function engravingDurationStyle(duration) {
    const numerator = Number(duration?.numerator), denominator = Number(duration?.denominator);
    if (!Number.isSafeInteger(numerator) || numerator <= 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
        throw new ValidationError("Engraving duration requires positive safe-integer numerator and denominator values.");
    }
    const leftNumerator = BigInt(numerator), leftDenominator = BigInt(denominator);
    for (let basePower = 0; basePower <= 6; basePower += 1) {
        for (let dotCount = 0; dotCount <= 3; dotCount += 1) {
            const valueNumerator = (1n << BigInt(dotCount + 1)) - 1n;
            const valueDenominator = 1n << BigInt(basePower + dotCount);
            if (leftNumerator * valueDenominator !== leftDenominator * valueNumerator) continue;
            const flags = Math.max(0, basePower - 2);
            return Object.freeze({
                kind: kinds[basePower],
                baseDenominator: 2 ** basePower,
                open: basePower <= 1,
                stem: basePower > 0,
                flags,
                dotCount,
                dotted: dotCount > 0
            });
        }
    }
    throw new ValidationError(`Unsupported engraving duration "${numerator}/${denominator}"; supported bases are whole through sixty-fourth with up to three augmentation dots.`);
}
