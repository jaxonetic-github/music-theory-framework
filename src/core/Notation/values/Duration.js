import { ImmutableValue, ValidationError } from "../../Foundation/index.js";

function greatestCommonDivisor(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
}

export class Duration extends ImmutableValue {
    constructor(value = { numerator: 1, denominator: 4 }) {
        if (value instanceof Duration) return value;
        const source = typeof value === "number" ? { numerator: value, denominator: 1 } : value ?? {};
        let numerator = Number(source.numerator);
        let denominator = Number(source.denominator);
        if (!Number.isInteger(numerator) || numerator <= 0 || !Number.isInteger(denominator) || denominator <= 0) {
            throw new ValidationError("A duration requires positive integer numerator and denominator values.");
        }
        const divisor = greatestCommonDivisor(numerator, denominator);
        numerator /= divisor;
        denominator /= divisor;
        super({ numerator, denominator });
    }

    static from(value) { return value instanceof Duration ? value : new Duration(value); }
    get wholeNotes() { return this.numerator / this.denominator; }
    toString() { return `${this.numerator}/${this.denominator}`; }
}

export default Duration;
