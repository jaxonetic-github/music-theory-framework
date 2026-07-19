import { ImmutableValue } from "../../Foundation/index.js";
import { PitchClass } from "../values/index.js";
import { ScalePattern } from "./ScalePattern.js";

export class Scale extends ImmutableValue {
    constructor({ root, pattern, pitchClasses } = {}) {
        const normalizedRoot = PitchClass.from(root);
        const normalizedPattern = ScalePattern.from(pattern);
        const tones = pitchClasses ?? normalizedPattern.intervals.map(interval => normalizedRoot.transpose(interval));
        super({ root: normalizedRoot, pattern: normalizedPattern, pitchClasses: Object.freeze(tones.map(tone => PitchClass.from(tone))) });
    }

    contains(pitchClass) { return this.pitchClasses.some(tone => tone.enharmonicEquals(pitchClass)); }
    degree(number) {
        const index = Number(number) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= this.pitchClasses.length) return null;
        return this.pitchClasses[index];
    }
    toString() { return `${this.root} ${this.pattern.name}`; }
}

export default Scale;
