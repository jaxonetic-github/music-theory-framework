import { ValidationError } from "../Foundation/index.js";

const keys = new Set(["tempo", "resolution", "velocity", "pluginId", "strategyId"]);

function optionalId(value, label) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) throw new ValidationError(`${label} must be a non-empty string.`);
    return normalized;
}

export class PlaybackRequest {
    constructor(value = {}) {
        if (value instanceof PlaybackRequest) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new ValidationError("Playback options must be an object.");
        }
        const unknown = Object.keys(value).filter(key => !keys.has(key));
        if (unknown.length) throw new ValidationError(`Unknown playback option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
        const tempo = Number(value.tempo ?? 120);
        if (!Number.isFinite(tempo) || tempo <= 0) throw new ValidationError("Playback tempo must be a positive finite number.");
        const velocity = Number(value.velocity ?? 96);
        if (!Number.isInteger(velocity) || velocity < 1 || velocity > 127) {
            throw new ValidationError("Playback velocity must be an integer from 1 through 127.");
        }
        const resolution = value.resolution === undefined || value.resolution === null ? null : Number(value.resolution);
        if (resolution !== null && (!Number.isSafeInteger(resolution) || resolution < 1)) {
            throw new ValidationError("Playback resolution must be a positive safe integer.");
        }
        const pluginId = optionalId(value.pluginId, "Playback pluginId");
        const strategyId = optionalId(value.strategyId, "Playback strategyId");
        if (strategyId && !pluginId) throw new ValidationError("Playback strategyId requires a pluginId.");
        Object.defineProperties(this, {
            tempo: { value: tempo, enumerable: true },
            resolution: { value: resolution, enumerable: true },
            velocity: { value: velocity, enumerable: true },
            pluginId: { value: pluginId, enumerable: true },
            strategyId: { value: strategyId, enumerable: true }
        });
        Object.freeze(this);
    }

    static from(value) { return value instanceof PlaybackRequest ? value : new PlaybackRequest(value); }
}

export default PlaybackRequest;
