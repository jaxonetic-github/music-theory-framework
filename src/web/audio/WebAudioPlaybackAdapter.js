import { PlaybackPlan, ValidationError } from "../../core/index.js";
import { AudioPlaybackRequest } from "./AudioPlaybackRequest.js";
import { AudioPlaybackSession } from "./AudioPlaybackSession.js";
import { AudioPlaybackState } from "./AudioPlaybackState.js";
import { AudioVoice } from "./AudioVoice.js";

export function midiToFrequency(midi) {
    const value = Number(midi);
    if (!Number.isInteger(value) || value < 0 || value > 127) throw new ValidationError("MIDI note must be an integer from 0 through 127.");
    return 440 * 2 ** ((value - 69) / 12);
}

export function velocityToGain(velocity, masterGain = 0.2) {
    const value = Number(velocity);
    const gain = Number(masterGain);
    if (!Number.isInteger(value) || value < 1 || value > 127) throw new ValidationError("Velocity must be an integer from 1 through 127.");
    if (!Number.isFinite(gain) || gain < 0 || gain > 1) throw new ValidationError("Master gain must be a finite number from 0 through 1.");
    return value / 127 * gain;
}

function validateContext(context, { checkTime = true } = {}) {
    if (!context || typeof context !== "object") throw new ValidationError("An AudioContext-compatible object is required.");
    if (context.state === "closed") throw new ValidationError("The AudioContext is closed.");
    if (!["running", "suspended"].includes(context.state)) throw new ValidationError(`Invalid AudioContext state: "${String(context.state)}".`);
    if (checkTime) {
        const currentTime = Number(context.currentTime);
        if (!Number.isFinite(currentTime) || currentTime < 0) throw new ValidationError("AudioContext currentTime must be a non-negative finite number.");
    }
    if (typeof context.createOscillator !== "function" || typeof context.createGain !== "function" || !context.destination) {
        throw new ValidationError("The AudioContext does not implement the required Web Audio contract.");
    }
    return context;
}

function attempt(operation, errors) { try { operation(); } catch (error) { errors.push(error); } }

export class WebAudioPlaybackAdapter {
    #context;
    #contextFactory;
    #owned = false;
    #disposed = false;
    #sequence = 0;
    #sessions = new Set();

    constructor(options = {}) {
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new ValidationError("Web Audio adapter options must be an object.");
        const unknown = Object.keys(options).filter(key => !["context", "contextFactory"].includes(key));
        if (unknown.length) throw new ValidationError(`Unknown Web Audio adapter option${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
        const { context = null, contextFactory = null } = options;
        if (context && contextFactory) throw new ValidationError("Provide either an AudioContext instance or a factory, not both.");
        if (context !== null) validateContext(context);
        if (contextFactory !== null && typeof contextFactory !== "function") throw new ValidationError("AudioContext factory must be a function.");
        this.#context = context;
        this.#contextFactory = contextFactory;
        this.#owned = context === null;
        Object.seal(this);
    }

    get ownsContext() { return this.#owned; }
    get sessions() { return Object.freeze([...this.#sessions]); }

    async play(plan, options = {}) {
        if (this.#disposed) throw new ValidationError("The Web Audio playback adapter is disposed.");
        if (!(plan instanceof PlaybackPlan)) throw new ValidationError("WebAudioPlaybackAdapter.play() requires a PlaybackPlan.");
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new ValidationError("Audio playback options must be an object.");
        const request = new AudioPlaybackRequest({ ...options, plan });
        const context = await this.#resolveContext();
        if (context.state === "suspended") {
            if (typeof context.resume !== "function") throw new ValidationError("The suspended AudioContext cannot be resumed.");
            await context.resume();
            validateContext(context, { checkTime: false });
            if (context.state !== "running") throw new ValidationError("The AudioContext did not enter the running state after resume().");
        }
        const capturedTime = Number(context.currentTime);
        if (!Number.isFinite(capturedTime) || capturedTime < 0) throw new ValidationError("AudioContext currentTime must be a non-negative finite number.");
        const startTime = capturedTime + request.startDelay;
        const totalSeconds = plan.ticksToSeconds(plan.totalTicks);
        const endTime = startTime + totalSeconds + request.release;
        if (![startTime, totalSeconds, endTime].every(Number.isFinite)) throw new ValidationError("Derived Web Audio scheduling values must be finite.");
        const records = [];
        const voices = [];
        let remaining = plan.events.length;
        let stopped = false;
        let disposed = false;
        const control = {};
        const sessionId = request.sessionId ?? `web-audio-session-${++this.#sequence}`;
        let session;

        const cleanup = cancel => {
            const errors = [];
            for (const record of records) {
                if (cancel) attempt(() => record.oscillator?.stop?.(), errors);
                attempt(() => record.oscillator?.disconnect?.(), errors);
                attempt(() => record.gain?.disconnect?.(), errors);
            }
            return errors;
        };
        const stop = () => {
            if (stopped || disposed || [AudioPlaybackState.STOPPED, AudioPlaybackState.COMPLETED, AudioPlaybackState.FAILED].includes(session.state)) return session;
            stopped = true;
            const errors = cleanup(true);
            if (errors.length) {
                control.transition(AudioPlaybackState.FAILED);
                throw new AggregateError(errors, "Failed to stop one or more Web Audio session nodes.");
            }
            control.transition(AudioPlaybackState.STOPPED);
            return session;
        };
        const dispose = () => {
            if (disposed) return session;
            const errors = [];
            if (![AudioPlaybackState.COMPLETED, AudioPlaybackState.FAILED].includes(session.state)) {
                try { stop(); } catch (error) { errors.push(error); }
            }
            errors.push(...cleanup(false));
            disposed = true;
            this.#sessions.delete(session);
            if (errors.length) {
                control.transition(AudioPlaybackState.FAILED);
                throw new AggregateError(errors, "Failed to dispose the Web Audio session.");
            }
            return session;
        };

        try {
            for (const event of plan.events) {
                const relativeStart = plan.ticksToSeconds(event.startTick);
                const duration = plan.ticksToSeconds(event.durationTicks);
                const eventStart = startTime + relativeStart;
                const noteEnd = eventStart + duration;
                const releaseEnd = noteEnd + request.release;
                const attackEnd = eventStart + Math.min(request.attack, duration);
                if (![relativeStart, duration, eventStart, noteEnd, releaseEnd, attackEnd].every(Number.isFinite) || duration <= 0) {
                    throw new ValidationError(`Playback event "${event.sourceEventId}" has invalid derived timing.`);
                }
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                records.push({ oscillator, gain });
                const frequency = midiToFrequency(event.midi);
                const peakGain = velocityToGain(event.velocity, request.masterGain);
                oscillator.type = request.waveform;
                oscillator.frequency.setValueAtTime(frequency, eventStart);
                gain.gain.setValueAtTime(0, eventStart);
                gain.gain.linearRampToValueAtTime(peakGain, attackEnd);
                gain.gain.setValueAtTime(peakGain, noteEnd);
                gain.gain.linearRampToValueAtTime(0, releaseEnd);
                oscillator.connect(gain);
                gain.connect(context.destination);
                voices.push(new AudioVoice({
                    sequence: event.sequence, sourceEventId: event.sourceEventId, writtenPitch: event.writtenPitch,
                    midi: event.midi, frequency, velocity: event.velocity, peakGain, startTime: eventStart,
                    durationSeconds: duration, stopTime: releaseEnd, partId: event.partId, measureId: event.measureId,
                    voiceId: event.voiceId, chordId: event.chordId, chordIndex: event.chordIndex
                }));
                oscillator.onended = () => {
                    const errors = [];
                    attempt(() => oscillator.disconnect?.(), errors);
                    attempt(() => gain.disconnect?.(), errors);
                    if (errors.length) control.transition?.(AudioPlaybackState.FAILED);
                    remaining -= 1;
                    if (remaining === 0 && !stopped && session?.state !== AudioPlaybackState.FAILED) control.transition(AudioPlaybackState.COMPLETED);
                };
                oscillator.start(eventStart);
                oscillator.stop(releaseEnd);
            }
            session = new AudioPlaybackSession({
                id: sessionId, request, contextTime: capturedTime, startTime, endTime,
                voices, stop, dispose, control,
                metadata: {
                    planPluginId: plan.metadata.pluginId ?? null, planStrategyId: plan.metadata.strategyId ?? null,
                    sourceEvents: voices.map(voice => ({ sequence: voice.sequence, sourceEventId: voice.sourceEventId, writtenPitch: voice.writtenPitch }))
                }
            });
            this.#sessions.add(session);
            control.transition(plan.events.length === 0
                ? AudioPlaybackState.COMPLETED
                : request.startDelay > 0 ? AudioPlaybackState.SCHEDULED : AudioPlaybackState.PLAYING);
            return session;
        } catch (error) {
            const cleanupErrors = cleanup(true);
            if (session) control.transition(AudioPlaybackState.FAILED);
            if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Web Audio scheduling and cleanup failed.", { cause: error });
            throw error;
        }
    }

    async dispose() {
        if (this.#disposed) return;
        this.#disposed = true;
        const errors = [];
        for (const session of [...this.#sessions]) {
            try { session.dispose(); } catch (error) { errors.push(error); }
        }
        this.#sessions.clear();
        if (this.#owned && this.#context && this.#context.state !== "closed") {
            try { await this.#context.close(); } catch (error) { errors.push(error); }
        }
        if (errors.length) throw new AggregateError(errors, "Failed to dispose the Web Audio playback adapter.");
    }

    async #resolveContext() {
        if (this.#context) return validateContext(this.#context, { checkTime: false });
        let context;
        if (this.#contextFactory) context = await this.#contextFactory();
        else {
            const AudioContextType = globalThis.AudioContext ?? globalThis.webkitAudioContext;
            if (typeof AudioContextType !== "function") throw new ValidationError("Web Audio is unavailable; provide an AudioContext-compatible instance or factory.");
            context = new AudioContextType();
        }
        this.#context = validateContext(context, { checkTime: false });
        return this.#context;
    }
}

export default WebAudioPlaybackAdapter;
