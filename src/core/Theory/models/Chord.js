import { ImmutableValue } from "../../Foundation/index.js";
import { PitchClass } from "../values/index.js";
import { ChordPattern } from "./ChordPattern.js";

export class Chord extends ImmutableValue {
    constructor({ root, pattern, pitchClasses } = {}) {
        const normalizedRoot = PitchClass.from(root);
        const normalizedPattern = ChordPattern.from(pattern);
        const tones = pitchClasses ?? normalizedPattern.intervals.map(interval => normalizedRoot.transpose(interval));
        super({ root: normalizedRoot, pattern: normalizedPattern, pitchClasses: Object.freeze(tones.map(tone => PitchClass.from(tone))) });
    }

    contains(pitchClass) { return this.pitchClasses.some(tone => tone.enharmonicEquals(pitchClass)); }
    toString() { return `${this.root}${this.pattern.symbol}`; }
}

export default Chord;
