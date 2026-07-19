import { PlaybackPlan, ValidationError } from "../../core/index.js";
import { AudioPlaybackState, WebAudioPlaybackAdapter } from "../audio/index.js";
import { PlaybackTransportRequest } from "./PlaybackTransportRequest.js";
import { PlaybackTransportSnapshot } from "./PlaybackTransportSnapshot.js";
import { PlaybackTransportState } from "./PlaybackTransportState.js";

const sessionStates = Object.freeze({
    [AudioPlaybackState.SCHEDULED]: PlaybackTransportState.SCHEDULED,
    [AudioPlaybackState.PLAYING]: PlaybackTransportState.PLAYING,
    [AudioPlaybackState.STOPPED]: PlaybackTransportState.STOPPED,
    [AudioPlaybackState.COMPLETED]: PlaybackTransportState.COMPLETED,
    [AudioPlaybackState.FAILED]: PlaybackTransportState.FAILED
});

function adapterContract(adapter) {
    if (!adapter || typeof adapter.play !== "function" || typeof adapter.dispose !== "function") {
        throw new ValidationError("Playback transport adapter must implement play() and dispose().");
    }
    return adapter;
}

function sessionContract(session) {
    if (!session || typeof session !== "object" || typeof session.stop !== "function"
        || typeof session.dispose !== "function" || typeof session.subscribe !== "function"
        || String(session.id ?? "").trim() === "" || !Object.hasOwn(sessionStates, session.state)) {
        throw new ValidationError("Playback adapter returned an invalid AudioPlaybackSession contract.");
    }
    return session;
}

function publicError(error) {
    if (!error) return null;
    return Object.freeze({
        name: String(error.name ?? "Error"),
        message: String(error.message ?? error)
    });
}

function aggregate(errors, message) {
    if (errors.length === 0) return null;
    return errors.length === 1 ? errors[0] : new AggregateError(errors, message);
}

export class PlaybackTransportController {
    #adapter;
    #ownsAdapter;
    #plan = null;
    #session = null;
    #sessionUnsubscribe = null;
    #state = PlaybackTransportState.IDLE;
    #operation = 0;
    #error = null;
    #snapshot;
    #listeners = new Set();
    #disposed = false;
    #adapterDisposed = false;

    constructor({ adapter, adapterFactory } = {}) {
        if (adapter !== undefined && adapterFactory !== undefined) throw new ValidationError("Provide either a playback adapter or adapterFactory, not both.");
        if (adapterFactory !== undefined && typeof adapterFactory !== "function") throw new ValidationError("Playback transport adapterFactory must be a function.");
        this.#ownsAdapter = adapter === undefined;
        this.#adapter = adapterContract(adapter ?? (adapterFactory ?? (() => new WebAudioPlaybackAdapter()))());
        this.#snapshot = new PlaybackTransportSnapshot({ state: this.#state, plan: null, sessionId: null, operationSequence: 0, error: null });
        Object.seal(this);
    }

    get snapshot() { return this.#snapshot; }
    get plan() { return this.#plan; }
    get session() { return this.#session; }

    subscribe(listener) {
        this.#requireActive("subscribe");
        if (typeof listener !== "function") throw new ValidationError("Playback transport subscriber must be a function.");
        this.#listeners.add(listener);
        let subscribed = true;
        return () => {
            if (!subscribed) return false;
            subscribed = false;
            return this.#listeners.delete(listener);
        };
    }

    load(plan) {
        this.#requireActive("load");
        if (!(plan instanceof PlaybackPlan)) throw new ValidationError("PlaybackTransportController.load() requires a PlaybackPlan.");
        if (plan === this.#plan && this.#session === null && this.#state === PlaybackTransportState.READY && this.#error === null) return this.#snapshot;
        this.#operation += 1;
        const cleanupError = this.#releaseCurrentSession();
        if (cleanupError) {
            this.#fail(cleanupError, true);
            throw cleanupError;
        }
        this.#plan = plan;
        this.#error = null;
        this.#transition(PlaybackTransportState.READY, true);
        return this.#snapshot;
    }

    async play(options = {}) {
        this.#requireActive("play");
        if (!(this.#plan instanceof PlaybackPlan)) throw new ValidationError("Playback transport play() requires a loaded PlaybackPlan.");
        const request = new PlaybackTransportRequest(this.#plan, options);
        const token = ++this.#operation;
        const cleanupError = this.#releaseCurrentSession();
        if (cleanupError) throw this.#fail(cleanupError, true);
        this.#error = null;
        this.#transition(PlaybackTransportState.STARTING, true);
        let rawSession;
        try {
            rawSession = await this.#adapter.play(request.plan, request.audioOptions);
        } catch (error) {
            if (token !== this.#operation || this.#disposed) throw error;
            this.#fail(error, true);
            throw error;
        }
        if (token !== this.#operation || this.#disposed) {
            const staleError = this.#cleanupSession(rawSession);
            if (staleError) throw staleError;
            return this.#snapshot;
        }
        let session;
        try {
            session = sessionContract(rawSession);
            this.#session = session;
            this.#sessionUnsubscribe = session.subscribe((state, source) => this.#observeSession(state, source));
        } catch (error) {
            this.#detachSession();
            const cleanupError = this.#cleanupSession(rawSession);
            const failure = cleanupError ? new AggregateError([error, cleanupError], "Playback session adoption failed.", { cause: error }) : error;
            this.#fail(failure, true);
            throw failure;
        }
        this.#transition(sessionStates[session.state], true);
        return this.#snapshot;
    }

    replay(options = {}) { return this.play(options); }

    stop() {
        this.#requireActive("stop");
        if (this.#plan === null) throw new ValidationError("Playback transport stop() requires a loaded PlaybackPlan.");
        if (this.#state === PlaybackTransportState.STOPPED && this.#session === null) return this.#snapshot;
        this.#operation += 1;
        const cleanupError = this.#releaseCurrentSession();
        if (cleanupError) {
            this.#fail(cleanupError, true);
            throw cleanupError;
        }
        this.#error = null;
        this.#transition(PlaybackTransportState.STOPPED, true);
        return this.#snapshot;
    }

    async dispose() {
        if (this.#disposed) return this.#snapshot;
        this.#disposed = true;
        this.#operation += 1;
        const errors = [];
        const sessionError = this.#releaseCurrentSession();
        if (sessionError) errors.push(sessionError);
        if (this.#ownsAdapter && !this.#adapterDisposed) {
            try { await this.#adapter.dispose(); } catch (error) { errors.push(error); }
            this.#adapterDisposed = true;
        }
        const error = aggregate(errors, "Playback transport disposal failed.");
        this.#error = error;
        this.#transition(PlaybackTransportState.DISPOSED, true);
        if (error) throw error;
        return this.#snapshot;
    }

    #observeSession(state, source) {
        if (source !== this.#session || this.#disposed) return;
        const transportState = sessionStates[state];
        if (!transportState) return;
        if (transportState === PlaybackTransportState.FAILED) {
            this.#error = new Error("The audio playback session failed.");
        }
        this.#transition(transportState, true);
    }

    #releaseCurrentSession() {
        const session = this.#session;
        this.#detachSession();
        return session ? this.#cleanupSession(session) : null;
    }

    #detachSession() {
        this.#sessionUnsubscribe?.();
        this.#sessionUnsubscribe = null;
        this.#session = null;
    }

    #cleanupSession(session) {
        const errors = [];
        if (session && typeof session.stop === "function") {
            try { session.stop(); } catch (error) { errors.push(error); }
        }
        if (session && typeof session.dispose === "function") {
            try { session.dispose(); } catch (error) { errors.push(error); }
        }
        return aggregate(errors, "Playback transport session cleanup failed.");
    }

    #fail(error, emit) {
        this.#error = error;
        this.#transition(PlaybackTransportState.FAILED, emit);
        return error;
    }

    #transition(state, emit) {
        const error = publicError(this.#error);
        const next = new PlaybackTransportSnapshot({
            state, plan: this.#plan, sessionId: this.#session?.id ?? null,
            operationSequence: this.#operation, error
        });
        const previous = this.#snapshot;
        const changed = previous.state !== next.state || previous.plan !== next.plan
            || previous.sessionId !== next.sessionId || previous.operationSequence !== next.operationSequence
            || previous.error?.name !== next.error?.name || previous.error?.message !== next.error?.message;
        this.#state = state;
        if (!changed) return;
        this.#snapshot = next;
        if (!emit) return;
        for (const listener of [...this.#listeners]) {
            try { listener(next); } catch {}
        }
    }

    #requireActive(operation) {
        if (this.#disposed) throw new ValidationError(`Cannot ${operation} a disposed playback transport.`);
    }
}

export default PlaybackTransportController;
