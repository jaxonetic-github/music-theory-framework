import { PlaybackPlan, ValidationError } from "../../core/index.js";
import { AudioPlaybackRequest } from "../audio/index.js";

export class PlaybackTransportRequest {
    constructor(plan, options = {}) {
        if (!(plan instanceof PlaybackPlan)) throw new ValidationError("Playback transport requires a PlaybackPlan.");
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new ValidationError("Playback transport play options must be an object.");
        const audio = new AudioPlaybackRequest({ ...options, plan });
        const audioOptions = Object.freeze({
            sessionId: audio.sessionId,
            startDelay: audio.startDelay,
            masterGain: audio.masterGain,
            waveform: audio.waveform,
            attack: audio.attack,
            release: audio.release
        });
        Object.defineProperties(this, {
            plan: { value: plan, enumerable: true },
            audioOptions: { value: audioOptions, enumerable: true }
        });
        Object.freeze(this);
    }
}

export default PlaybackTransportRequest;
