import { FactoryContract } from "../../Foundation/index.js";
import { Scale } from "../models/index.js";
import { Note, PitchClass } from "../values/index.js";
import { ScaleCatalog } from "../catalogs/index.js";

export class ScaleGenerator extends FactoryContract {
    constructor(catalog = new ScaleCatalog()) { super(); this.catalog = catalog; Object.seal(this); }

    generate(root, pattern = "major", options = {}) {
        const definition = typeof pattern === "string" ? this.catalog.get(pattern, { required: true }) : pattern;
        const normalizedRoot = new PitchClass(root, options.prefer ? { prefer: options.prefer } : {});
        const pitchClasses = definition.intervals.map(interval => normalizedRoot.transpose(interval, options));
        return new Scale({ root: normalizedRoot, pattern: definition, pitchClasses });
    }

    generateNotes(root, pattern = "major", octave = 4, options = {}) {
        const scale = this.generate(root, pattern, options);
        const tonic = new Note(scale.root, octave);
        return Object.freeze(scale.pattern.intervals.map(interval => tonic.transpose(interval, options)));
    }

    build(specification = {}) { return this.generate(specification.root, specification.pattern, specification); }
}

export default ScaleGenerator;
