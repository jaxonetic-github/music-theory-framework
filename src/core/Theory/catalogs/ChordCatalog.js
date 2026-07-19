import { ChordPattern } from "../models/index.js";
import { defaultChordPatterns } from "./defaultPatterns.js";
import { PatternCatalog } from "./PatternCatalog.js";

export class ChordCatalog extends PatternCatalog {
    constructor(patterns = defaultChordPatterns) { super(ChordPattern, patterns); }
}

export default ChordCatalog;
