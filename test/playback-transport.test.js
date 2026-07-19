import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Kernel, PlaybackPlan, PlaybackRequest } from "../src/core/index.js";
import { AudioPlaybackSession, AudioPlaybackState } from "../src/web/audio/index.js";
import {
    PlaybackTransportController, PlaybackTransportModule, PlaybackTransportRequest,
    PlaybackTransportSnapshot, PlaybackTransportState, Transport,
    playbackTransportPackageDescriptor, playbackTransportPluginDescriptor, playbackTransportServiceDescriptor
} from "../src/web/transport/index.js";

function plan(id = "plan") {
    return new PlaybackPlan({
        request: new PlaybackRequest(), resolution: 1, totalTicks: 0,
        metadata: { scoreId: id, pluginId: "core.playback.score", strategyId: "score" }
    });
}

function deferred() {
    let resolve; let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function audioSession(id, state = AudioPlaybackState.PLAYING, options = {}) {
    const control = {};
    const calls = { stop: 0, dispose: 0 };
    let session;
    session = new AudioPlaybackSession({
        id, request: Object.freeze({}), contextTime: 0, startTime: 0, endTime: 1,
        voices: [], metadata: { sourceEvents: [] }, control,
        stop() {
            calls.stop += 1;
            if (options.failStop) throw new Error(`stop failed: ${id}`);
            control.transition(AudioPlaybackState.STOPPED);
            return session;
        },
        dispose() {
            calls.dispose += 1;
            if (options.failDispose) throw new Error(`dispose failed: ${id}`);
            return session;
        }
    });
    control.transition(state);
    return { session, control, calls };
}

class FakeAdapter {
    constructor(play = () => audioSession("session").session) { this.playImplementation = play; }
    playCalls = [];
    disposeCalls = 0;
    async play(source, options) { this.playCalls.push([source, options]); return this.playImplementation(source, options); }
    async dispose() { this.disposeCalls += 1; }
}

test("transport begins idle, validates plans, and loads exact plan identity", async () => {
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter() });
    assert.equal(controller.snapshot.state, PlaybackTransportState.IDLE);
    assert.ok(controller.snapshot instanceof PlaybackTransportSnapshot);
    assert.equal(Object.isFrozen(controller.snapshot), true);
    assert.throws(() => controller.load({}), /PlaybackPlan/);
    await assert.rejects(() => controller.play(), /loaded PlaybackPlan/);
    const source = plan("loaded");
    const ready = controller.load(source);
    assert.equal(ready.state, PlaybackTransportState.READY);
    assert.strictEqual(ready.plan, source);
    assert.strictEqual(controller.plan, source);
    assert.equal(ready.planId, "loaded");
    assert.equal(ready.operationSequence, 1);
    assert.equal(JSON.stringify(source), JSON.stringify(controller.plan));
});

test("play exposes starting while pending and reflects scheduled, playing, and completed sessions", async () => {
    const pending = deferred();
    const adapter = new FakeAdapter(() => pending.promise);
    const controller = new PlaybackTransportController({ adapter });
    const source = plan();
    controller.load(source);
    const playing = controller.play({ startDelay: 1, waveform: "triangle" });
    assert.equal(controller.snapshot.state, PlaybackTransportState.STARTING);
    assert.strictEqual(adapter.playCalls[0][0], source);
    assert.equal(adapter.playCalls[0][1].startDelay, 1);
    const scheduled = audioSession("scheduled", AudioPlaybackState.SCHEDULED);
    pending.resolve(scheduled.session);
    assert.equal((await playing).state, PlaybackTransportState.SCHEDULED);
    scheduled.control.transition(AudioPlaybackState.PLAYING);
    assert.equal(controller.snapshot.state, PlaybackTransportState.PLAYING);
    scheduled.control.transition(AudioPlaybackState.COMPLETED);
    assert.equal(controller.snapshot.state, PlaybackTransportState.COMPLETED);
});

test("empty completed sessions and adapter failures update transport automatically", async () => {
    const completed = audioSession("empty", AudioPlaybackState.COMPLETED);
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => completed.session) });
    controller.load(plan());
    assert.equal((await controller.play()).state, PlaybackTransportState.COMPLETED);
    completed.control.transition(AudioPlaybackState.FAILED);
    assert.equal(controller.snapshot.state, PlaybackTransportState.FAILED);

    const failure = new Error("audio unavailable");
    const failed = new PlaybackTransportController({ adapter: new FakeAdapter(async () => { throw failure; }) });
    failed.load(plan());
    await assert.rejects(() => failed.play(), /audio unavailable/);
    assert.equal(failed.snapshot.state, PlaybackTransportState.FAILED);
    assert.deepEqual(failed.snapshot.error, { name: "Error", message: "audio unavailable" });
    assert.equal(Object.isFrozen(failed.snapshot.error), true);
});

test("stop is idempotent, preserves the plan, and replay creates a new session", async () => {
    const first = audioSession("first");
    const second = audioSession("second");
    const sessions = [first.session, second.session];
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => sessions.shift()) });
    const source = plan(); controller.load(source);
    await controller.play();
    const stopped = controller.stop();
    const sequence = stopped.operationSequence;
    assert.equal(stopped.state, PlaybackTransportState.STOPPED);
    assert.strictEqual(controller.plan, source);
    assert.equal(first.calls.stop, 1);
    assert.equal(first.calls.dispose, 1);
    assert.strictEqual(controller.stop(), stopped);
    assert.equal(controller.snapshot.operationSequence, sequence);
    await controller.replay();
    assert.equal(controller.session.id, "second");
    assert.equal(controller.snapshot.state, PlaybackTransportState.PLAYING);
});

test("replacement play and replacement load clean only the current owned session", async () => {
    const first = audioSession("first"); const second = audioSession("second");
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => first.calls.dispose ? second.session : first.session) });
    controller.load(plan("one"));
    await controller.play();
    await controller.play();
    assert.equal(first.calls.stop, 1); assert.equal(first.calls.dispose, 1);
    const replacement = plan("two");
    controller.load(replacement);
    assert.equal(second.calls.stop, 1); assert.equal(second.calls.dispose, 1);
    assert.strictEqual(controller.plan, replacement);
    assert.equal(controller.snapshot.state, PlaybackTransportState.READY);
});

test("same-plan ready reload is idempotent while terminal states may reload", async () => {
    const source = plan();
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter() });
    const ready = controller.load(source);
    assert.strictEqual(controller.load(source), ready);
    const active = audioSession("same-plan-active");
    const activeController = new PlaybackTransportController({ adapter: new FakeAdapter(() => active.session) });
    activeController.load(source); await activeController.play(); activeController.load(source);
    assert.equal(active.calls.stop, 1); assert.equal(active.calls.dispose, 1);
    assert.equal(activeController.snapshot.state, PlaybackTransportState.READY);
    controller.stop();
    assert.equal(controller.load(source).state, PlaybackTransportState.READY);
    const completed = audioSession("done", AudioPlaybackState.COMPLETED);
    const completeController = new PlaybackTransportController({ adapter: new FakeAdapter(() => completed.session) });
    completeController.load(source); await completeController.play();
    assert.equal(completeController.load(source).state, PlaybackTransportState.READY);
    const failed = new PlaybackTransportController({ adapter: new FakeAdapter(async () => { throw new Error("fail"); }) });
    failed.load(source); await assert.rejects(() => failed.play());
    assert.equal(failed.load(source).state, PlaybackTransportState.READY);
});

test("stop and disposal cleanup failures are normalized without leaking owned sessions", async () => {
    const broken = audioSession("broken", AudioPlaybackState.PLAYING, { failStop: true, failDispose: true });
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => broken.session) });
    controller.load(plan()); await controller.play();
    assert.throws(() => controller.stop(), /session cleanup failed/);
    assert.equal(controller.snapshot.state, PlaybackTransportState.FAILED);
    assert.equal(controller.session, null);
    assert.equal(broken.calls.stop, 1); assert.equal(broken.calls.dispose, 1);
});

test("transport subscribers are ordered, isolated, idempotently removable, and receive no idempotent duplicates", () => {
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter() });
    const calls = [];
    const unsubscribeFirst = controller.subscribe(snapshot => { calls.push(`first:${snapshot.state}`); throw new Error("listener"); });
    const unsubscribeSecond = controller.subscribe(snapshot => calls.push(`second:${snapshot.state}`));
    const source = plan();
    controller.load(source);
    controller.load(source);
    assert.deepEqual(calls, ["first:ready", "second:ready"]);
    assert.equal(unsubscribeFirst(), true);
    assert.equal(unsubscribeFirst(), false);
    controller.stop();
    assert.deepEqual(calls.at(-1), "second:stopped");
    assert.equal(unsubscribeSecond(), true);
});

test("AudioPlaybackSession subscriptions are ordered, isolated, and idempotently removable", () => {
    const value = audioSession("observed", AudioPlaybackState.SCHEDULED);
    const calls = [];
    const first = value.session.subscribe(state => { calls.push(`first:${state}`); throw new Error("listener"); });
    value.session.subscribe(state => calls.push(`second:${state}`));
    value.control.transition(AudioPlaybackState.PLAYING);
    value.control.transition(AudioPlaybackState.PLAYING);
    assert.deepEqual(calls, ["first:playing", "second:playing"]);
    assert.equal(first(), true); assert.equal(first(), false);
    value.control.transition(AudioPlaybackState.COMPLETED);
    assert.equal(calls.at(-1), "second:completed");
});

test("stale play success after load is cleaned and ignored", async () => {
    const pending = deferred(); const stale = audioSession("stale");
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => pending.promise) });
    controller.load(plan("old")); const play = controller.play();
    const current = plan("new"); controller.load(current);
    pending.resolve(stale.session); await play;
    assert.equal(stale.calls.stop, 1); assert.equal(stale.calls.dispose, 1);
    assert.strictEqual(controller.plan, current);
    assert.equal(controller.snapshot.state, PlaybackTransportState.READY);
});

test("stale play success after stop and dispose is cleaned and ignored", async () => {
    for (const operation of ["stop", "dispose"]) {
        const pending = deferred(); const stale = audioSession(`stale-${operation}`);
        const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => pending.promise) });
        controller.load(plan()); const play = controller.play();
        await controller[operation]();
        pending.resolve(stale.session); await play;
        assert.equal(stale.calls.stop, 1, operation); assert.equal(stale.calls.dispose, 1, operation);
        assert.equal(controller.snapshot.state, operation === "stop" ? PlaybackTransportState.STOPPED : PlaybackTransportState.DISPOSED);
    }
});

test("stale rejection cannot overwrite a newer loaded state", async () => {
    const pending = deferred();
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => pending.promise) });
    controller.load(plan("old")); const play = controller.play();
    const current = plan("new"); controller.load(current);
    pending.reject(new Error("stale failure"));
    await assert.rejects(() => play, /stale failure/);
    assert.strictEqual(controller.plan, current);
    assert.equal(controller.snapshot.state, PlaybackTransportState.READY);
    assert.equal(controller.snapshot.error, null);
});

test("overlapping plays retain only the latest session and clean stale success", async () => {
    const firstPending = deferred(); const secondPending = deferred();
    let calls = 0;
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => (++calls === 1 ? firstPending : secondPending).promise) });
    controller.load(plan());
    const firstPlay = controller.play(); const secondPlay = controller.play();
    const second = audioSession("second"); secondPending.resolve(second.session); await secondPlay;
    const first = audioSession("first"); firstPending.resolve(first.session); await firstPlay;
    assert.strictEqual(controller.session, second.session);
    assert.equal(first.calls.stop, 1); assert.equal(first.calls.dispose, 1);
    assert.equal(second.calls.stop, 0);
});

test("stale detached session completion cannot overwrite a newer session", async () => {
    const first = audioSession("first"); const second = audioSession("second");
    const queue = [first.session, second.session];
    const controller = new PlaybackTransportController({ adapter: new FakeAdapter(() => queue.shift()) });
    controller.load(plan()); await controller.play(); await controller.replay();
    first.control.transition(AudioPlaybackState.COMPLETED);
    assert.strictEqual(controller.session, second.session);
    assert.equal(controller.snapshot.state, PlaybackTransportState.PLAYING);
});

test("concurrent controllers sharing a borrowed adapter remain isolated and never dispose it", async () => {
    const first = audioSession("first"); const second = audioSession("second");
    const queue = [first.session, second.session];
    const adapter = new FakeAdapter(() => queue.shift());
    const one = new PlaybackTransportController({ adapter });
    const two = new PlaybackTransportController({ adapter });
    one.load(plan("one")); two.load(plan("two"));
    await one.play(); await two.play(); one.stop();
    assert.equal(first.calls.stop, 1); assert.equal(second.calls.stop, 0);
    await one.dispose(); await two.dispose();
    assert.equal(adapter.disposeCalls, 0);
});

test("owned adapters dispose exactly once and disposed controllers reject every other operation", async () => {
    const adapter = new FakeAdapter();
    const controller = new PlaybackTransportController({ adapterFactory: () => adapter });
    await controller.dispose(); await controller.dispose();
    assert.equal(adapter.disposeCalls, 1);
    assert.equal(controller.snapshot.state, PlaybackTransportState.DISPOSED);
    assert.throws(() => controller.load(plan()), /disposed/);
    assert.throws(() => controller.stop(), /disposed/);
    assert.throws(() => controller.subscribe(() => {}), /disposed/);
    await assert.rejects(() => controller.play(), /disposed/);
});

test("PlaybackTransportModule registers transactionally outside planner and renderer discovery", async () => {
    const kernel = new Kernel();
    const adapters = [];
    const module = new PlaybackTransportModule({ controllerFactory: () => {
        const adapter = new FakeAdapter(); adapters.push(adapter);
        return new PlaybackTransportController({ adapterFactory: () => adapter });
    } });
    module.configure(kernel.context);
    assert.strictEqual(kernel.services.resolve("web.playback.transport"), module.controller);
    assert.strictEqual(kernel.registries.services.resolve("web.playback.transport"), module.controller);
    assert.strictEqual(kernel.registries.plugins.resolve("web.playback.transport"), module.plugin);
    assert.equal(kernel.registries.playbacks.size, 0); assert.equal(kernel.registries.renderers.size, 0);
    module.controller.load(plan()); await module.controller.play();
    await module.dispose(); module.configure(kernel.context);
    module.controller.load(plan("again"));
    assert.equal((await module.controller.play()).state, PlaybackTransportState.PLAYING);
    await module.dispose();
    assert.equal(adapters.length, 2);
    assert.equal(adapters[0].disposeCalls, 1); assert.equal(adapters[1].disposeCalls, 1);
});

test("PlaybackTransportModule preserves collisions, listener rollback, and replacements", async () => {
    for (const point of ["container", "service", "plugin"]) {
        const kernel = new Kernel();
        const module = new PlaybackTransportModule({ controller: new PlaybackTransportController({ adapter: new FakeAdapter() }) });
        const existing = point === "container" ? module.controller : point === "service" ? module.controller : module.plugin;
        if (point === "container") kernel.services.register("web.playback.transport", existing);
        if (point === "service") kernel.registries.services.register(playbackTransportServiceDescriptor, { value: existing });
        if (point === "plugin") kernel.registries.plugins.register(playbackTransportPluginDescriptor, { value: existing });
        assert.throws(() => module.configure(kernel.context));
        assert.strictEqual(kernel.services.resolve("web.playback.transport", { optional: true }), point === "container" ? existing : null);
        assert.strictEqual(kernel.registries.services.resolve("web.playback.transport"), point === "service" ? existing : null);
        assert.strictEqual(kernel.registries.plugins.resolve("web.playback.transport"), point === "plugin" ? existing : null);
    }
    const listenerKernel = new Kernel();
    const listenerModule = new PlaybackTransportModule({ controller: new PlaybackTransportController({ adapter: new FakeAdapter() }) });
    const unsubscribe = listenerKernel.registries.plugins.subscribe(() => { throw new Error("listener failure"); });
    assert.throws(() => listenerModule.configure(listenerKernel.context), /listener failure/); unsubscribe();
    assert.equal(listenerKernel.services.has("web.playback.transport"), false);
    assert.equal(listenerKernel.registries.services.has("web.playback.transport"), false);
    assert.equal(listenerKernel.registries.plugins.has("web.playback.transport"), false);

    const kernel = new Kernel();
    const module = new PlaybackTransportModule({ controller: new PlaybackTransportController({ adapter: new FakeAdapter() }) });
    module.configure(kernel.context);
    const container = {}; const service = {}; const plugin = {};
    kernel.services.register("web.playback.transport", container, { replace: true });
    kernel.registries.services.register(playbackTransportServiceDescriptor, { value: service, replace: true });
    kernel.registries.plugins.register(playbackTransportPluginDescriptor, { value: plugin, replace: true });
    await module.dispose(); await module.dispose();
    assert.strictEqual(kernel.services.resolve("web.playback.transport"), container);
    assert.strictEqual(kernel.registries.services.resolve("web.playback.transport"), service);
    assert.strictEqual(kernel.registries.plugins.resolve("web.playback.transport"), plugin);
});

test("browser Transport namespace is frozen, v7.5, and excluded from Core", async () => {
    const webEntry = await readFile(new URL("../src/web/index.js", import.meta.url), "utf8");
    const coreEntry = await readFile(new URL("../src/core/index.js", import.meta.url), "utf8");
    assert.match(webEntry, /default as Transport/);
    assert.doesNotMatch(coreEntry, /transport/i);
    assert.equal(Transport.PlaybackTransportController, PlaybackTransportController);
    assert.equal(Object.isFrozen(Transport), true);
    assert.equal(String(playbackTransportPackageDescriptor.version), "7.5.0");
    assert.equal(playbackTransportServiceDescriptor.metadata.attributes.playbackPlanner, false);
    assert.ok(new PlaybackTransportRequest(plan(), {}) instanceof PlaybackTransportRequest);
    assert.equal(Object.isFrozen(new PlaybackTransportRequest(plan(), {})), true);
    const previous = globalThis.AudioContext;
    delete globalThis.AudioContext;
    assert.equal(new PlaybackTransportController().snapshot.state, PlaybackTransportState.IDLE);
    if (previous !== undefined) globalThis.AudioContext = previous;
});
