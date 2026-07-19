import { ScalePattern, ChordPattern } from "../models/index.js";

export const defaultScalePatterns = Object.freeze([
    new ScalePattern({ id: "major", name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] }),
    new ScalePattern({ id: "natural-minor", name: "Natural Minor", intervals: [0, 2, 3, 5, 7, 8, 10] }),
    new ScalePattern({ id: "harmonic-minor", name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] }),
    new ScalePattern({ id: "melodic-minor", name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] }),
    new ScalePattern({ id: "dorian", name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] }),
    new ScalePattern({ id: "phrygian", name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] }),
    new ScalePattern({ id: "lydian", name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] }),
    new ScalePattern({ id: "mixolydian", name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] }),
    new ScalePattern({ id: "locrian", name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] }),
    new ScalePattern({ id: "major-pentatonic", name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] }),
    new ScalePattern({ id: "minor-pentatonic", name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] }),
    new ScalePattern({ id: "blues", name: "Blues", intervals: [0, 3, 5, 6, 7, 10] }),
    new ScalePattern({ id: "chromatic", name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
]);

export const defaultChordPatterns = Object.freeze([
    new ChordPattern({ id: "major", name: "Major", symbol: "", intervals: [0, 4, 7] }),
    new ChordPattern({ id: "minor", name: "Minor", symbol: "m", intervals: [0, 3, 7] }),
    new ChordPattern({ id: "diminished", name: "Diminished", symbol: "dim", intervals: [0, 3, 6] }),
    new ChordPattern({ id: "augmented", name: "Augmented", symbol: "+", intervals: [0, 4, 8] }),
    new ChordPattern({ id: "suspended-2", name: "Suspended Second", symbol: "sus2", intervals: [0, 2, 7] }),
    new ChordPattern({ id: "suspended-4", name: "Suspended Fourth", symbol: "sus4", intervals: [0, 5, 7] }),
    new ChordPattern({ id: "dominant-7", name: "Dominant Seventh", symbol: "7", intervals: [0, 4, 7, 10] }),
    new ChordPattern({ id: "major-7", name: "Major Seventh", symbol: "maj7", intervals: [0, 4, 7, 11] }),
    new ChordPattern({ id: "minor-7", name: "Minor Seventh", symbol: "m7", intervals: [0, 3, 7, 10] }),
    new ChordPattern({ id: "half-diminished-7", name: "Half-Diminished Seventh", symbol: "m7b5", intervals: [0, 3, 6, 10] }),
    new ChordPattern({ id: "diminished-7", name: "Diminished Seventh", symbol: "dim7", intervals: [0, 3, 6, 9] })
]);
