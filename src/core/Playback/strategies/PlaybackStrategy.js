import { Identifier, StrategyContract, ValidationError } from "../../Foundation/index.js";

export class PlaybackStrategy extends StrategyContract {
    constructor({ id, pluginId } = {}) {
        super();
        this.id = Identifier.from(id);
        this.pluginId = Identifier.from(pluginId);
        if (!String(this.id) || !String(this.pluginId)) throw new ValidationError("Playback strategies require ids.");
        Object.freeze(this);
    }

    supports() { return false; }
    plan() { throw new Error("PlaybackStrategy.plan() must be implemented."); }
    execute(score, request) { return this.plan(score, request); }
}

export default PlaybackStrategy;
