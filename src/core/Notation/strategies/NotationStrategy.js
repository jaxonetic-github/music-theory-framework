import { Identifier, StrategyContract, ValidationError } from "../../Foundation/index.js";

export class NotationStrategy extends StrategyContract {
    constructor({ id, pluginId, inputType } = {}) {
        super();
        this.id = Identifier.from(id);
        this.pluginId = Identifier.from(pluginId);
        this.inputType = String(inputType ?? "");
        if (!this.inputType) throw new ValidationError("A notation strategy must declare an input type.");
        Object.freeze(this);
    }

    supports() { return false; }
    notate() { throw new Error("NotationStrategy.notate() must be implemented."); }
    execute(result, options) { return this.notate(result, options); }
}

export default NotationStrategy;
