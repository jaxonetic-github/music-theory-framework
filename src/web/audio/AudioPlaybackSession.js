import { cloneDeep, freezeDeep, ValidationError } from "../../core/index.js";
import { AudioPlaybackState } from "./AudioPlaybackState.js";

export class AudioPlaybackSession {
    #state = AudioPlaybackState.SCHEDULED;
    #stop;
    #dispose;
    #listeners = new Set();

    constructor({ id, request, contextTime, startTime, endTime, voices, metadata, stop, dispose, control }) {
        Object.defineProperties(this, {
            id: { value: id, enumerable: true },
            request: { value: request, enumerable: true },
            contextTime: { value: contextTime, enumerable: true },
            startTime: { value: startTime, enumerable: true },
            endTime: { value: endTime, enumerable: true },
            voices: { value: Object.freeze([...voices]), enumerable: true },
            metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true }
        });
        this.#stop = stop;
        this.#dispose = dispose;
        control.transition = state => {
            if (this.#state === state) return;
            this.#state = state;
            for (const listener of [...this.#listeners]) {
                try { listener(state, this); } catch {}
            }
        };
        Object.freeze(this);
    }

    get state() { return this.#state; }
    stop() { return this.#stop(); }
    dispose() { return this.#dispose(); }
    subscribe(listener) {
        if (typeof listener !== "function") throw new ValidationError("Audio playback session listener must be a function.");
        this.#listeners.add(listener);
        let subscribed = true;
        return () => {
            if (!subscribed) return false;
            subscribed = false;
            return this.#listeners.delete(listener);
        };
    }
}

export default AudioPlaybackSession;
