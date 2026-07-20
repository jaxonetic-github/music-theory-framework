import { ProgressionDefinition } from "./ProgressionDefinition.js";

export const defaultProgressions = Object.freeze([
    new ProgressionDefinition({ id: "ii-v-i-major", name: "ii–V–I in major", mode: "major", events: [
        { degree: 2, romanNumeral: "ii7", function: "predominant", quality: "minor-7" },
        { degree: 5, romanNumeral: "V7", function: "dominant", quality: "dominant-7" },
        { degree: 1, romanNumeral: "Imaj7", function: "tonic", quality: "major-7" }
    ] }),
    new ProgressionDefinition({ id: "ii-half-diminished-v-i-minor", name: "iiø–V–i in minor", mode: "minor", events: [
        { degree: 2, romanNumeral: "iiø7", function: "predominant", quality: "half-diminished-7" },
        { degree: 5, romanNumeral: "V7", function: "dominant", quality: "dominant-7" },
        { degree: 1, romanNumeral: "i7", function: "tonic", quality: "minor-7" }
    ] }),
    new ProgressionDefinition({ id: "i-vi-ii-v", name: "I–vi–ii–V", mode: "major", events: [
        { degree: 1, romanNumeral: "Imaj7", function: "tonic", quality: "major-7" },
        { degree: 6, romanNumeral: "vi7", function: "tonic-prolongation", quality: "minor-7" },
        { degree: 2, romanNumeral: "ii7", function: "predominant", quality: "minor-7" },
        { degree: 5, romanNumeral: "V7", function: "dominant", quality: "dominant-7" }
    ] }),
    new ProgressionDefinition({ id: "twelve-bar-dominant-blues", name: "Twelve-bar dominant blues", mode: "major", events: [1,1,1,1,4,4,1,1,5,4,1,5].map(degree => ({ degree, romanNumeral: `${degree === 1 ? "I" : degree === 4 ? "IV" : "V"}7`, function: degree === 1 ? "tonic" : degree === 4 ? "subdominant" : "dominant", quality: "dominant-7" })) })
]);
