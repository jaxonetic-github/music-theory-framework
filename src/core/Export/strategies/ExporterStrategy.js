import { Identifier, StrategyContract, ValidationError } from "../../Foundation/index.js";

export class ExporterStrategy extends StrategyContract {
    constructor({ id, pluginId, format, mediaType } = {}) {
        super();
        this.id = Identifier.from(id);
        this.pluginId = Identifier.from(pluginId);
        this.format = String(format ?? "").trim().toLowerCase();
        this.mediaType = String(mediaType ?? "").trim().toLowerCase();
        if (!this.format) throw new ValidationError("An exporter strategy must declare a format.");
        if (!this.mediaType || !this.mediaType.includes("/")) throw new ValidationError("An exporter strategy must declare a valid media type.");
        Object.freeze(this);
    }

    supports() { return false; }
    export() { throw new Error("ExporterStrategy.export() must be implemented."); }
    execute(score, options) { return this.export(score, options); }
}

export default ExporterStrategy;
