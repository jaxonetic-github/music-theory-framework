import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
    Kernel, Note, PlaybackEvent, PlaybackPlan, PlaybackRequest
} from "../src/core/index.js";
import {
    AudioPlaybackRequest, AudioPlaybackSession, AudioPlaybackState, AudioVoice, WebAudio,
    WebAudioPlaybackAdapter, WebAudioPlaybackModule, midiToFrequency, velocityToGain,
    webAudioPackageDescriptor, webAudioPluginDescriptor, webAudioServiceDescriptor
} from "../src/web/audio/index.js";

function playbackEvent(sequence, pitch, startTick, durationTicks = 1, values = {}) {
    return new PlaybackEvent({
        sequence, note: Note.from(pitch), startTick, durationTicks, velocity: values.velocity ?? 96,
        partId: values.partId ?? "part:1", measureId: values.measureId ?? "measure:1", measureNumber: 1,
        voiceId: values.voiceId ?? "voice:1", voiceIndex: values.voiceIndex ?? 1,
        sourceEventId: values.sourceEventId ?? `event:${sequence}`,
        chordId: values.chordId ?? null, chordIndex: values.chordIndex ?? null
    });
}

function plan(events = [], { tempo = 120, resolution = 1, totalTicks = null } = {}) {
    return new PlaybackPlan({
        request: new PlaybackRequest({ tempo }), resolution, events,
        totalTicks: totalTicks ?? events.reduce((maximum, event) => Math.max(maximum, event.endTick), 0),
        metadata: { pluginId: "core.playback.score", strategyId: "score" }
    });
}

class FakeParam {
    calls = [];
    setValueAtTime(value, time) { if (this.failSet) throw new Error("parameter set failed"); this.calls.push(["set", value, time]); }
    linearRampToValueAtTime(value, time) { if (this.failRamp) throw new Error("parameter ramp failed"); this.calls.push(["ramp", value, time]); }
}

class FakeOscillator {
    frequency = new FakeParam();
    type = "sine";
    starts = [];
    stops = [];
    disconnected = 0;
    onended = null;
    connect(node) { if (this.failConnect) throw new Error("oscillator connect failed"); this.connected = node; return node; }
    start(time) { if (this.failStart) throw new Error("start failed"); this.starts.push(time); }
    stop(time) { if (this.failStop) throw new Error("stop failed"); this.stops.push(time); }
    disconnect() { this.disconnected += 1; }
    end() { this.onended?.(); }
}

class FakeGain {
    gain = new FakeParam();
    disconnected = 0;
    connect(node) { if (this.failConnect) throw new Error("gain connect failed"); this.connected = node; return node; }
    disconnect() { this.disconnected += 1; }
}

class FakeAudioContext {
    destination = Object.freeze({ id: "destination" });
    oscillators = [];
    gains = [];
    resumeCalls = 0;
    closeCalls = 0;
    currentTimeReads = 0;
    failOscillatorAt = null;
    failGainAt = null;
    failOperation = null;
    #time;

    constructor({ currentTime = 10, state = "running" } = {}) { this.#time = currentTime; this.state = state; }
    get currentTime() { this.currentTimeReads += 1; return this.#time; }
    createOscillator() {
        if (this.failOscillatorAt === this.oscillators.length) throw new Error("oscillator failed");
        const oscillator = new FakeOscillator();
        if (this.failOperation === "frequency") oscillator.frequency.failSet = true;
        if (this.failOperation === "oscillator-connect") oscillator.failConnect = true;
        if (this.failOperation === "start") oscillator.failStart = true;
        if (this.failOperation === "stop") oscillator.failStop = true;
        this.oscillators.push(oscillator); return oscillator;
    }
    createGain() {
        if (this.failGainAt === this.gains.length) throw new Error("gain creation failed");
        const gain = new FakeGain();
        if (this.failOperation === "gain-set") gain.gain.failSet = true;
        if (this.failOperation === "gain-ramp") gain.gain.failRamp = true;
        if (this.failOperation === "gain-connect") gain.failConnect = true;
        this.gains.push(gain); return gain;
    }
    async resume() { this.resumeCalls += 1; this.state = "running"; }
    async close() { this.closeCalls += 1; this.state = "closed"; }
}

test("MIDI frequency and velocity gain conversions are exact and validated", () => {
    assert.equal(midiToFrequency(69), 440);
    assert.equal(midiToFrequency(60), 440 * 2 ** ((60 - 69) / 12));
    assert.equal(velocityToGain(127, 0.5), 0.5);
    assert.equal(velocityToGain(64, 0.25), 64 / 127 * 0.25);
    assert.throws(() => midiToFrequency(128), /MIDI/);
    assert.throws(() => velocityToGain(0), /Velocity/);
});

test("single and sequential notes use canonical tick timing and one captured context time", async () => {
    const source = plan([playbackEvent(1, "A4", 0), playbackEvent(2, "B4", 2)], { tempo: 60, resolution: 2, totalTicks: 3 });
    const context = new FakeAudioContext({ currentTime: 4 });
    const adapter = new WebAudioPlaybackAdapter({ context });
    const readsBefore = context.currentTimeReads;
    const session = await adapter.play(source, { sessionId: "timing", startDelay: 0.25 });
    assert.equal(context.currentTimeReads - readsBefore, 1);
    assert.deepEqual(context.oscillators.map(value => value.starts[0]), [4.25, 5.25]);
    assert.deepEqual(session.voices.map(value => value.durationSeconds), [0.5, 0.5]);
    assert.deepEqual(session.voices.map(value => value.sequence), [1, 2]);
    assert.equal(session.contextTime, 4);
    assert.equal(session.state, AudioPlaybackState.SCHEDULED);
});

test("chords, voices, and parts preserve equal and overlapping plan starts without reordering", async () => {
    const events = [
        playbackEvent(1, "C4", 0, 4, { chordId: "ch", chordIndex: 0, sourceEventId: "ch" }),
        playbackEvent(2, "E4", 0, 4, { chordId: "ch", chordIndex: 1, sourceEventId: "ch" }),
        playbackEvent(3, "G3", 0, 2, { partId: "part:2", voiceId: "voice:2", voiceIndex: 2 }),
        playbackEvent(4, "D4", 2, 2, { voiceId: "voice:3", voiceIndex: 3 })
    ];
    const session = await new WebAudioPlaybackAdapter({ context: new FakeAudioContext() }).play(plan(events, { resolution: 4 }));
    assert.deepEqual(session.voices.map(voice => voice.sequence), [1, 2, 3, 4]);
    assert.equal(session.voices[0].startTime, session.voices[1].startTime);
    assert.equal(session.voices[0].startTime, session.voices[2].startTime);
    assert.equal(session.voices[3].startTime, session.startTime + 0.25);
    assert.equal(session.voices.length, 4);
});

test("default synthesis schedules deterministic waveform, frequency, velocity, attack, and release", async () => {
    const context = new FakeAudioContext({ currentTime: 2 });
    const source = plan([playbackEvent(1, "A4", 0, 1, { velocity: 127 })]);
    const session = await new WebAudioPlaybackAdapter({ context }).play(source);
    assert.equal(context.oscillators[0].type, "sine");
    assert.deepEqual(context.oscillators[0].frequency.calls, [["set", 440, 2]]);
    assert.deepEqual(context.gains[0].gain.calls, [
        ["set", 0, 2], ["ramp", 0.2, 2.005], ["set", 0.2, 2.5], ["ramp", 0, 2.52]
    ]);
    assert.equal(session.voices[0].stopTime, 2.52);
});

test("requests and contexts reject malformed input without silent clamping", async () => {
    const source = plan();
    assert.throws(() => new AudioPlaybackRequest({ plan: {}, waveform: "sine" }), /PlaybackPlan/);
    for (const values of [{ startDelay: -1 }, { masterGain: 2 }, { waveform: "noise" }, { attack: Infinity }, { release: -1 }]) {
        assert.throws(() => new AudioPlaybackRequest({ plan: source, ...values }));
    }
    assert.throws(() => new WebAudioPlaybackAdapter({ context: {} }), /AudioContext/);
    assert.throws(() => new WebAudioPlaybackAdapter({ unknown: true }), /Unknown Web Audio adapter option/);
    assert.throws(() => new WebAudioPlaybackAdapter([]), /options must be an object/);
    assert.throws(() => new WebAudioPlaybackAdapter({ context: new FakeAudioContext({ state: "closed" }) }), /closed/);
    assert.throws(() => new WebAudioPlaybackAdapter({ context: new FakeAudioContext({ state: "invalid" }) }), /Invalid AudioContext state/);
    assert.throws(() => new WebAudioPlaybackAdapter({ context: new FakeAudioContext(), contextFactory: () => new FakeAudioContext() }), /either/);
    const adapter = new WebAudioPlaybackAdapter();
    await assert.rejects(() => adapter.play(source, null), /options must be an object/);
    const previous = globalThis.AudioContext;
    delete globalThis.AudioContext;
    await assert.rejects(() => adapter.play(source), /Web Audio is unavailable/);
    if (previous !== undefined) globalThis.AudioContext = previous;
});

test("suspended contexts resume only on explicit play and borrowed contexts never close", async () => {
    const context = new FakeAudioContext({ state: "suspended" });
    const adapter = new WebAudioPlaybackAdapter({ context });
    assert.equal(context.resumeCalls, 0);
    await adapter.play(plan());
    assert.equal(context.resumeCalls, 1);
    await adapter.dispose();
    await adapter.dispose();
    assert.equal(context.closeCalls, 0);
});

test("owned contexts are lazy and close only during explicit adapter disposal", async () => {
    const context = new FakeAudioContext();
    let factoryCalls = 0;
    const adapter = new WebAudioPlaybackAdapter({ contextFactory: () => { factoryCalls += 1; return context; } });
    assert.equal(factoryCalls, 0);
    await adapter.play(plan());
    assert.equal(factoryCalls, 1);
    assert.equal(context.closeCalls, 0);
    await adapter.dispose();
    assert.equal(context.closeCalls, 1);
});

test("empty plans complete without oscillators and session public data is immutable", async () => {
    const context = new FakeAudioContext();
    const session = await new WebAudioPlaybackAdapter({ context }).play(plan(), { sessionId: "empty" });
    assert.ok(session instanceof AudioPlaybackSession);
    assert.equal(session.state, AudioPlaybackState.COMPLETED);
    assert.equal(context.oscillators.length, 0);
    assert.equal(Object.isFrozen(session.request), true);
    assert.equal(Object.isFrozen(session.voices), true);
    assert.equal(Object.isFrozen(session.metadata), true);
    assert.throws(() => session.voices.push("x"), TypeError);
});

test("sessions complete from source callbacks and stop/dispose idempotently", async () => {
    const context = new FakeAudioContext();
    const adapter = new WebAudioPlaybackAdapter({ context });
    const completed = await adapter.play(plan([playbackEvent(1, "C4", 0)]));
    assert.equal(completed.state, AudioPlaybackState.PLAYING);
    context.oscillators[0].end();
    assert.equal(completed.state, AudioPlaybackState.COMPLETED);
    completed.stop();
    assert.equal(completed.state, AudioPlaybackState.COMPLETED);
    completed.dispose(); completed.dispose();

    const stopped = await adapter.play(plan([playbackEvent(1, "D4", 0)]));
    stopped.stop(); stopped.stop();
    assert.equal(stopped.state, AudioPlaybackState.STOPPED);
    assert.ok(context.oscillators[1].stops.length >= 2);

    const failed = await adapter.play(plan([playbackEvent(1, "E4", 0)]));
    context.oscillators[2].failStop = true;
    assert.throws(() => failed.stop(), /Failed to stop/);
    assert.equal(failed.state, AudioPlaybackState.FAILED);
});

test("concurrent repeated playback creates independent sessions and stopping is isolated", async () => {
    const context = new FakeAudioContext();
    const adapter = new WebAudioPlaybackAdapter({ context });
    const source = plan([playbackEvent(1, "C4", 0)]);
    const first = await adapter.play(source);
    const second = await adapter.play(source);
    assert.notEqual(first.id, second.id);
    assert.notStrictEqual(first, second);
    first.stop();
    assert.equal(first.state, AudioPlaybackState.STOPPED);
    assert.equal(second.state, AudioPlaybackState.PLAYING);
    assert.equal(context.oscillators[1].stops.length, 1);
});

test("partial scheduling failure cancels and disconnects every created node", async () => {
    const context = new FakeAudioContext();
    context.failOscillatorAt = 1;
    const adapter = new WebAudioPlaybackAdapter({ context });
    await assert.rejects(() => adapter.play(plan([playbackEvent(1, "C4", 0), playbackEvent(2, "D4", 1)])), /oscillator failed/);
    assert.ok(context.oscillators[0].stops.length >= 2);
    assert.ok(context.oscillators[0].disconnected >= 1);
    assert.ok(context.gains[0].disconnected >= 1);
    assert.equal(adapter.sessions.length, 0);
});

test("createGain failure cleans the oscillator allocated immediately before it", async () => {
    const context = new FakeAudioContext();
    context.failGainAt = 0;
    const adapter = new WebAudioPlaybackAdapter({ context });
    await assert.rejects(() => adapter.play(plan([playbackEvent(1, "C4", 0)])), /gain creation failed/);
    assert.equal(context.oscillators.length, 1);
    assert.equal(context.gains.length, 0);
    assert.equal(context.oscillators[0].stops.length, 1);
    assert.equal(context.oscillators[0].disconnected, 1);
    assert.equal(adapter.sessions.length, 0);
});

test("automation, connection, start, and stop failures clean every allocated node", async () => {
    for (const operation of ["frequency", "gain-set", "gain-ramp", "oscillator-connect", "gain-connect", "start", "stop"]) {
        const context = new FakeAudioContext();
        context.failOperation = operation;
        const adapter = new WebAudioPlaybackAdapter({ context });
        await assert.rejects(() => adapter.play(plan([playbackEvent(1, "C4", 0)])));
        assert.equal(context.oscillators.length, 1, operation);
        assert.equal(context.gains.length, 1, operation);
        assert.ok(context.oscillators[0].disconnected >= 1, operation);
        assert.ok(context.gains[0].disconnected >= 1, operation);
        assert.equal(adapter.sessions.length, 0, operation);
    }
});

test("session metadata retains spelling and identity without mutating the source plan", async () => {
    const source = plan([playbackEvent(1, "Cb4", 0, 1, { sourceEventId: "written-cb" })]);
    const before = JSON.stringify(source);
    const session = await new WebAudioPlaybackAdapter({ context: new FakeAudioContext() }).play(source);
    assert.equal(session.voices[0].writtenPitch, "Cb4");
    assert.equal(session.voices[0].sourceEventId, "written-cb");
    assert.deepEqual(session.metadata.sourceEvents, [{ sequence: 1, sourceEventId: "written-cb", writtenPitch: "Cb4" }]);
    assert.equal(JSON.stringify(source), before);
    assert.ok(session.voices[0] instanceof AudioVoice);
});

test("WebAudioPlaybackModule registers only service and plugin discovery transactionally", async () => {
    const kernel = new Kernel();
    const contexts = [];
    const module = new WebAudioPlaybackModule({
        adapterFactory: () => {
            const context = new FakeAudioContext();
            contexts.push(context);
            return new WebAudioPlaybackAdapter({ contextFactory: () => context });
        }
    });
    module.configure(kernel.context);
    const firstAdapter = module.adapter;
    assert.strictEqual(kernel.services.resolve("web.audio.playback"), module.adapter);
    assert.strictEqual(kernel.registries.services.resolve("web.audio.playback"), module.adapter);
    assert.strictEqual(kernel.registries.plugins.resolve("web.audio.oscillator"), module.plugin);
    assert.equal(kernel.registries.playbacks.size, 0);
    assert.equal(kernel.registries.renderers.size, 0);
    await module.adapter.play(plan([playbackEvent(1, "C4", 0)]));
    await module.dispose();
    assert.equal(contexts[0].closeCalls, 1);
    module.configure(kernel.context);
    assert.notStrictEqual(module.adapter, firstAdapter);
    assert.strictEqual(kernel.services.resolve("web.audio.playback"), module.adapter);
    const session = await module.adapter.play(plan([playbackEvent(1, "D4", 0)]));
    assert.equal(session.state, AudioPlaybackState.PLAYING);
    assert.equal(contexts[1].oscillators.length, 1);
    await module.dispose();
    assert.equal(contexts[1].closeCalls, 1);
});

test("WebAudioPlaybackModule preserves collisions, same objects, listener failures, and replacements", async () => {
    for (const point of ["container", "service", "plugin"]) {
        const kernel = new Kernel();
        const module = new WebAudioPlaybackModule({ adapter: new WebAudioPlaybackAdapter({ context: new FakeAudioContext() }) });
        const existing = point === "container" ? module.adapter : point === "service" ? module.adapter : module.plugin;
        if (point === "container") kernel.services.register("web.audio.playback", existing);
        if (point === "service") kernel.registries.services.register(webAudioServiceDescriptor, { value: existing });
        if (point === "plugin") kernel.registries.plugins.register(webAudioPluginDescriptor, { value: existing });
        assert.throws(() => module.configure(kernel.context));
        assert.strictEqual(kernel.services.resolve("web.audio.playback", { optional: true }), point === "container" ? existing : null);
        assert.strictEqual(kernel.registries.services.resolve("web.audio.playback"), point === "service" ? existing : null);
        assert.strictEqual(kernel.registries.plugins.resolve("web.audio.oscillator"), point === "plugin" ? existing : null);
    }

    const listenerKernel = new Kernel();
    const listenerModule = new WebAudioPlaybackModule({ adapter: new WebAudioPlaybackAdapter({ context: new FakeAudioContext() }) });
    const unsubscribe = listenerKernel.registries.plugins.subscribe(() => { throw new Error("listener failed"); });
    assert.throws(() => listenerModule.configure(listenerKernel.context), /listener failed/);
    unsubscribe();
    assert.equal(listenerKernel.services.has("web.audio.playback"), false);
    assert.equal(listenerKernel.registries.services.has("web.audio.playback"), false);
    assert.equal(listenerKernel.registries.plugins.has("web.audio.oscillator"), false);

    const replacementKernel = new Kernel();
    const replacementModule = new WebAudioPlaybackModule({ adapter: new WebAudioPlaybackAdapter({ context: new FakeAudioContext() }) });
    replacementModule.configure(replacementKernel.context);
    const service = {}; const registered = {}; const plugin = {};
    replacementKernel.services.register("web.audio.playback", service, { replace: true });
    replacementKernel.registries.services.register(webAudioServiceDescriptor, { value: registered, replace: true });
    replacementKernel.registries.plugins.register(webAudioPluginDescriptor, { value: plugin, replace: true });
    await replacementModule.dispose(); await replacementModule.dispose();
    assert.strictEqual(replacementKernel.services.resolve("web.audio.playback"), service);
    assert.strictEqual(replacementKernel.registries.services.resolve("web.audio.playback"), registered);
    assert.strictEqual(replacementKernel.registries.plugins.resolve("web.audio.oscillator"), plugin);
});

test("browser-scoped namespace exposes v7.4 contracts without planner registration or eager audio", async () => {
    const webEntry = await readFile(new URL("../src/web/index.js", import.meta.url), "utf8");
    assert.match(webEntry, /default as WebAudio/);
    assert.equal(WebAudio.WebAudioPlaybackAdapter, WebAudioPlaybackAdapter);
    assert.equal(String(webAudioPackageDescriptor.version), "7.4.0");
    assert.equal(webAudioServiceDescriptor.metadata.attributes.browserScoped, true);
    assert.equal(webAudioServiceDescriptor.metadata.attributes.playbackPlanner, false);
    assert.equal(Object.isFrozen(WebAudio), true);
    assert.equal("AudioContext" in WebAudio, false);
});
