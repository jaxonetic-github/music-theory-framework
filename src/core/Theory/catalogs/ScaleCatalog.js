import { ScalePattern } from "../models/index.js";
import { defaultScalePatterns } from "./defaultPatterns.js";
import { PatternCatalog } from "./PatternCatalog.js";

export class ScaleCatalog extends PatternCatalog {
    constructor(patterns = defaultScalePatterns) { super(ScalePattern, patterns); }
}

export default ScaleCatalog;
