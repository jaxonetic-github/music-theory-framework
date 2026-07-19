import { Identifier, StrategyContract, ValidationError } from "../../Foundation/index.js";

export class RendererStrategy extends StrategyContract {
    constructor({ id, pluginId, format } = {}) {
        super();
        this.id = Identifier.from(id);
        this.pluginId = Identifier.from(pluginId);
        this.format = String(format ?? "").trim().toLowerCase();
        if (!this.format) throw new ValidationError("A renderer strategy must declare an output format.");
        Object.freeze(this);
    }

    supports() { return false; }
    render() { throw new Error("RendererStrategy.render() must be implemented."); }
    execute(score, options) { return this.render(score, options); }
}

export default RendererStrategy;
