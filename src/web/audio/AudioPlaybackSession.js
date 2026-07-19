import { cloneDeep, freezeDeep } from "../../core/index.js";
import { AudioPlaybackState } from "./AudioPlaybackState.js";

export class AudioPlaybackSession {
    #state = AudioPlaybackState.SCHEDULED;
    #stop;
    #dispose;

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
        control.transition = state => { this.#state = state; };
        Object.freeze(this);
    }

    get state() { return this.#state; }
    stop() { return this.#stop(); }
    dispose() { return this.#dispose(); }
}

export default AudioPlaybackSession;
