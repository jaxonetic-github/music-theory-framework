import { PlaybackPlan, ValidationError } from "../../core/index.js";

const waveforms = new Set(["sine", "square", "sawtooth", "triangle"]);
const keys = new Set(["plan", "sessionId", "startDelay", "masterGain", "waveform", "attack", "release"]);

function finite(value, label, { minimum = 0, maximum = Infinity, exclusiveMinimum = false } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || (exclusiveMinimum ? number <= minimum : number < minimum) || number > maximum) {
        throw new ValidationError(`${label} must be a finite number ${exclusiveMinimum ? "greater than" : "of at least"} ${minimum}${maximum < Infinity ? ` and at most ${maximum}` : ""}.`);
    }
    return number;
}

export class AudioPlaybackRequest {
    constructor(value = {}) {
        if (value instanceof AudioPlaybackRequest) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Audio playback options must be an object.");
        const unknown = Object.keys(value).filter(key => !keys.has(key));
        if (unknown.length) throw new ValidationError(`Unknown audio playback option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
        if (!(value.plan instanceof PlaybackPlan)) throw new ValidationError("Audio playback requires a PlaybackPlan.");
        const sessionId = value.sessionId === undefined || value.sessionId === null ? null : String(value.sessionId).trim();
        if (sessionId === "") throw new ValidationError("Audio playback sessionId must be a non-empty string.");
        const waveform = String(value.waveform ?? "sine").trim().toLowerCase();
        if (!waveforms.has(waveform)) throw new ValidationError(`Unsupported oscillator waveform: "${waveform}".`);
        Object.defineProperties(this, {
            plan: { value: value.plan, enumerable: true },
            sessionId: { value: sessionId, enumerable: true },
            startDelay: { value: finite(value.startDelay ?? 0, "Audio playback start delay"), enumerable: true },
            masterGain: { value: finite(value.masterGain ?? 0.2, "Audio playback master gain", { maximum: 1 }), enumerable: true },
            waveform: { value: waveform, enumerable: true },
            attack: { value: finite(value.attack ?? 0.005, "Audio playback attack"), enumerable: true },
            release: { value: finite(value.release ?? 0.02, "Audio playback release"), enumerable: true }
        });
        Object.freeze(this);
    }

    static from(value) { return value instanceof AudioPlaybackRequest ? value : new AudioPlaybackRequest(value); }
}

export default AudioPlaybackRequest;
