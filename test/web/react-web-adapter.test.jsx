import React, { StrictMode, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApplicationWorkflowError } from "../../src/core/index.js";
import { ApplicationProvider, useApplicationRuntime, useApplicationWorkflow } from "../../src/web/ApplicationProvider.jsx";
import { MusicTheoryWebApp } from "../../src/web/MusicTheoryWebApp.jsx";
import { createWebApplication } from "../../src/web/bootstrap.js";
import { usePlaybackTransport } from "../../src/web/usePlaybackTransport.js";

const catalogs = Object.freeze({
    scales: Object.freeze([{ id: "major", name: "Major" }, { id: "dorian", name: "Dorian" }]),
    chords: Object.freeze([{ id: "major", name: "Major" }, { id: "minor-7", name: "Minor Seventh" }])
});

class FakeTransport {
    constructor() {
        this.listeners = new Set();
        this.plan = null;
        this.playCalls = 0;
        this.stopCalls = 0;
        this.replayCalls = 0;
        this.sequence = 0;
        this.snapshot = Object.freeze({ state: "idle", plan: null, hasPlan: false, sessionId: null, operationSequence: 0, error: null });
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    transition(state, error = null) {
        this.sequence += 1;
        this.snapshot = Object.freeze({ state, plan: this.plan, hasPlan: Boolean(this.plan), sessionId: null, operationSequence: this.sequence, error });
        for (const listener of [...this.listeners]) listener();
    }
    load(plan) { this.plan = plan; this.transition("ready"); return this.snapshot; }
    async play() { this.playCalls += 1; this.transition("starting"); this.transition("scheduled"); return this.snapshot; }
    stop() { this.stopCalls += 1; this.transition("stopped"); return this.snapshot; }
    async replay() { this.replayCalls += 1; this.transition("starting"); this.transition("scheduled"); return this.snapshot; }
}

function bootstrapWith(application, dispose = vi.fn(async () => {}), overrides = {}) {
    return vi.fn(async () => Object.freeze({
        application,
        playback: { plan: vi.fn(() => { throw new Error("planning unavailable"); }) },
        transport: new FakeTransport(),
        catalogs,
        dispose,
        ...overrides
    }));
}

function RuntimeProbe() {
    const runtime = useApplicationRuntime();
    return <output>{runtime.status}</output>;
}

it("provider starts once across rerenders and disposes once on unmount", async () => {
    const dispose = vi.fn(async () => {});
    const bootstrap = bootstrapWith({ run() {} }, dispose);
    const view = render(<ApplicationProvider bootstrap={bootstrap}><RuntimeProbe /></ApplicationProvider>);
    await screen.findByText("ready");
    view.rerender(<ApplicationProvider bootstrap={bootstrap}><RuntimeProbe /><span>rerender</span></ApplicationProvider>);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    view.unmount();
    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
});

it("provider announces bootstrap failures without exposing a stack trace", async () => {
    const bootstrap = vi.fn(async () => { throw new Error("cannot start"); });
    render(<ApplicationProvider bootstrap={bootstrap}><MusicTheoryWebApp /></ApplicationProvider>);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("application bootstrap failed");
    expect(alert.textContent).toContain("cannot start");
    expect(alert.textContent).not.toContain(" at ");
});

function WorkflowProbe({ onRun }) {
    const { runtime, workflow, run } = useApplicationWorkflow();
    if (runtime.status !== "ready") return <span>{runtime.status}</span>;
    return <><output data-testid="workflow-state">{workflow.status}</output><button onClick={() => run({}).catch(() => {})}>Run</button>{onRun?.()}</>;
}

it("stale workflow completions are ignored after provider reconfiguration", async () => {
    let resolveFirst;
    const firstResult = new Promise(resolve => { resolveFirst = resolve; });
    const firstRuntime = { application: { run: () => firstResult }, catalogs, dispose: vi.fn(async () => {}) };
    const secondRuntime = { application: { run: () => ({}) }, catalogs, dispose: vi.fn(async () => {}) };
    const bootstrap = vi.fn(options => Promise.resolve(options.id === 1 ? firstRuntime : secondRuntime));
    const view = render(<ApplicationProvider bootstrap={bootstrap} bootstrapOptions={{ id: 1 }}><WorkflowProbe /></ApplicationProvider>);
    await screen.findByRole("button", { name: "Run" });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByTestId("workflow-state").textContent).toBe("loading");
    view.rerender(<ApplicationProvider bootstrap={bootstrap} bootstrapOptions={{ id: 2 }}><WorkflowProbe /></ApplicationProvider>);
    await waitFor(() => expect(screen.getByTestId("workflow-state").textContent).toBe("empty"));
    resolveFirst({ stale: true });
    await Promise.resolve();
    expect(screen.getByTestId("workflow-state").textContent).toBe("empty");
    expect(firstRuntime.dispose).toHaveBeenCalledTimes(1);
});

it("accessible controls update type, root, selection, octave, and optional outputs", async () => {
    const requests = [];
    const bootstrap = bootstrapWith({ run(request) { requests.push(request); throw new ApplicationWorkflowError("generation", new Error("stop")); } });
    render(<ApplicationProvider bootstrap={bootstrap}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: /build a theory request/i });
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Workflow results" })).toBeTruthy();
    expect(screen.getByLabelText("Root pitch")).toBeTruthy();
    expect(screen.getByLabelText("Scale pattern")).toBeTruthy();
    expect(screen.getByLabelText("Octave")).toBeTruthy();
    expect(screen.getByRole("button", { name: /generate scale/i })).toBeTruthy();

    await user.click(screen.getByLabelText("Chord"));
    expect(screen.queryByLabelText("Scale pattern")).toBeNull();
    await user.clear(screen.getByLabelText("Root pitch"));
    await user.type(screen.getByLabelText("Root pitch"), "F#");
    await user.selectOptions(screen.getByLabelText("Chord quality"), "minor-7");
    await user.selectOptions(screen.getByLabelText("Octave"), "5");
    await user.click(screen.getByLabelText("Prepare MusicXML export"));
    await user.click(screen.getByRole("button", { name: /generate chord/i }));
    expect(requests[0].root).toBe("F#");
    expect(requests[0].quality).toBe("minor-7");
    expect(requests[0].pattern).toBeNull();
    expect(requests[0].notationOptions.octave).toBe(5);
    expect(requests[0].rendering.format).toBe("svg");
    expect(requests[0].export.format).toBe("musicxml");
    expect(await screen.findByRole("alert")).toBeTruthy();
});

it("real workflow renders trusted SVG, exact spellings, metadata, and MusicXML availability", async () => {
    const runtime = await createWebApplication();
    const bootstrap = vi.fn(async () => runtime);
    render(<ApplicationProvider bootstrap={bootstrap}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: /build a theory request/i });
    const root = screen.getByLabelText("Root pitch");
    await user.clear(root);
    await user.type(root, "Eb");
    await user.click(screen.getByLabelText("Prepare MusicXML export"));
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    const score = await screen.findByRole("img", { name: /rendered score for eb major/i });
    expect(score.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("Eb", { selector: "li" })).toBeTruthy();
    expect(screen.getByText("scale", { selector: ".result-badge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download eb major as musicxml/i }).disabled).toBe(false);
    expect(document.querySelector(".workspace")).toBeTruthy();
    expect(document.querySelector(".svg-frame")).toBeTruthy();
});

it("flat, sharp, Cb, and B# roots remain visibly spelled through successful workflows", async () => {
    const runtime = await createWebApplication();
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByLabelText("Root pitch");
    for (const spelling of ["Eb", "F#", "Cb", "B#"]) {
        const root = screen.getByLabelText("Root pitch");
        await user.clear(root);
        await user.type(root, spelling);
        await user.click(screen.getByRole("button", { name: /generate scale/i }));
        expect(await screen.findByRole("heading", { name: new RegExp(`^${spelling.replace("#", "\\#")} `) })).toBeTruthy();
    }
});

describe.each(["generation", "notation", "rendering", "export"])("%s stage error", stage => {
    it("announces a stage-specific safe message", async () => {
        const application = { run() { throw new ApplicationWorkflowError(stage, new Error(`${stage} unavailable`)); } };
        render(<ApplicationProvider bootstrap={bootstrapWith(application)}><MusicTheoryWebApp /></ApplicationProvider>);
        const user = userEvent.setup();
        await screen.findByRole("button", { name: /generate scale/i });
        await user.click(screen.getByRole("button", { name: /generate scale/i }));
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain(`${stage} stage failed`);
        expect(alert.textContent).toContain(`${stage} unavailable`);
        expect(alert.textContent).not.toContain(" at ");
    });
});

it("download remains unavailable when no export result was requested", async () => {
    const runtime = await createWebApplication();
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    const button = await screen.findByRole("button", { name: /download .* as musicxml/i });
    expect(button.disabled).toBe(true);
});

it("download keeps the completed C scale identity after controls are edited to D", async () => {
    const runtime = await createWebApplication();
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByLabelText("Root pitch");
    await user.click(screen.getByLabelText("Prepare MusicXML export"));
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    const download = await screen.findByRole("button", { name: /download c major as musicxml/i });

    const root = screen.getByLabelText("Root pitch");
    await user.clear(root);
    await user.type(root, "D");
    expect(screen.getByRole("button", { name: /download c major as musicxml/i })).toBe(download);

    let downloadedFilename = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function clickDownload() {
        downloadedFilename = this.download;
    });
    const createObjectURL = vi.fn(() => "blob:completed-c-scale");
    const revokeObjectURL = vi.fn();
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
        await user.click(download);
        const blob = createObjectURL.mock.calls[0][0];
        const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(blob);
        });
        expect(content).toContain("<work-title>C Major</work-title>");
        expect(content).not.toContain("<work-title>D Major</work-title>");
        expect(blob.type).toBe("application/vnd.recordare.musicxml+xml");
        expect(downloadedFilename).toBe("c-scale.musicxml");
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:completed-c-scale");
    } finally {
        click.mockRestore();
        if (previousCreate) URL.createObjectURL = previousCreate;
        else delete URL.createObjectURL;
        if (previousRevoke) URL.revokeObjectURL = previousRevoke;
        else delete URL.revokeObjectURL;
    }
});

async function playableRuntime(overrides = {}) {
    const base = await createWebApplication();
    const transport = overrides.transport ?? new FakeTransport();
    const plan = vi.fn(score => base.playback.plan(score));
    const results = [];
    const application = { run(request) { const result = base.application.run(request); results.push(result); return result; } };
    return {
        base,
        transport,
        results,
        runtime: Object.freeze({
            application,
            playback: { plan },
            transport,
            catalogs: base.catalogs,
            dispose: () => base.dispose(),
            ...overrides.runtime
        }),
        plan
    };
}

it("plans the exact successful score, loads transport, and renders accessible controls without producing audio", async () => {
    const { runtime, transport, plan, results } = await playableRuntime();
    const previousAudioContext = globalThis.AudioContext;
    let audioReads = 0;
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, get() { audioReads += 1; throw new Error("eager audio"); } });
    try {
        render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
        const user = userEvent.setup();
        await screen.findByRole("button", { name: /generate scale/i });
        await user.click(screen.getByRole("button", { name: /generate scale/i }));
        await screen.findByRole("group", { name: "Playback controls" });
        expect(plan).toHaveBeenCalledTimes(1);
        expect(plan.mock.calls[0][0]).toBe(results[0].score);
        expect(Object.isFrozen(results[0])).toBe(true);
        expect(Object.isFrozen(results[0].score)).toBe(true);
        expect(transport.plan).toBeTruthy();
        expect(Object.isFrozen(transport.plan)).toBe(true);
        expect(audioReads).toBe(0);
        expect(screen.getByRole("button", { name: "Play" }).disabled).toBe(false);
        expect(screen.getByRole("button", { name: "Stop" }).disabled).toBe(true);
        expect(screen.getByRole("button", { name: "Replay" }).disabled).toBe(true);
        expect(screen.getByRole("status").textContent).toContain("ready");
    } finally {
        if (previousAudioContext === undefined) delete globalThis.AudioContext;
        else Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: previousAudioContext, writable: true });
    }
});

it("Play, Stop, and Replay issue only transport commands and preserve focus and form-edit playback", async () => {
    const { runtime, transport } = await playableRuntime();
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    const play = await screen.findByRole("button", { name: "Play" });
    play.focus();
    await user.click(play);
    expect(transport.playCalls).toBe(1);
    expect(document.activeElement).toBe(play);
    expect(screen.getByRole("status").textContent).toContain("scheduled");
    const root = screen.getByLabelText("Root pitch");
    await user.clear(root);
    await user.type(root, "D");
    expect(transport.stopCalls).toBe(0);
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(transport.stopCalls).toBe(1);
    expect(screen.getByRole("button", { name: "Replay" }).disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "Replay" }));
    expect(transport.replayCalls).toBe(1);
});

it("a new workflow stops active playback while stale form edits do not replace the loaded plan", async () => {
    const { runtime, transport } = await playableRuntime();
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    await screen.findByRole("button", { name: "Play" });
    const firstPlan = transport.plan;
    act(() => transport.transition("playing"));
    const root = screen.getByLabelText("Root pitch");
    await user.clear(root);
    await user.type(root, "D");
    expect(transport.plan).toBe(firstPlan);
    expect(transport.stopCalls).toBe(0);
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    expect(transport.stopCalls).toBe(1);
    await waitFor(() => expect(transport.plan).not.toBe(firstPlan));
});

it("planning failures remain playback alerts without discarding the generated result", async () => {
    const base = await createWebApplication();
    const transport = new FakeTransport();
    const runtime = Object.freeze({
        application: base.application, playback: { plan() { throw new Error("planner offline"); } },
        transport, catalogs: base.catalogs, dispose: () => base.dispose()
    });
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Playback planning failed");
    expect(alert.textContent).toContain("planner offline");
    expect(screen.getByRole("heading", { name: /c major/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" }).disabled).toBe(true);
});

it("autoplay failures stay visible with the result and rapid Play clicks do not duplicate commands", async () => {
    let rejectPlay;
    const transport = new FakeTransport();
    transport.play = vi.fn(() => {
        transport.playCalls += 1;
        transport.transition("starting");
        return new Promise((resolve, reject) => { rejectPlay = reject; });
    });
    const { runtime } = await playableRuntime({ transport });
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    const play = await screen.findByRole("button", { name: "Play" });
    fireEvent.click(play);
    fireEvent.click(play);
    await waitFor(() => expect(transport.play).toHaveBeenCalledTimes(1));
    const error = new Error("Autoplay is not allowed");
    error.name = "NotAllowedError";
    rejectPlay(error);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Autoplay is not allowed");
    expect(alert.textContent).toContain("Play or Replay action");
    expect(screen.getByRole("heading", { name: /c major/i })).toBeTruthy();
});

it("stale Play completion after Stop cannot overwrite the stopped UI", async () => {
    let resolvePlay;
    const transport = new FakeTransport();
    transport.play = vi.fn(() => {
        transport.playCalls += 1;
        transport.transition("starting");
        return new Promise(resolve => { resolvePlay = resolve; });
    });
    const { runtime } = await playableRuntime({ transport });
    render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Play" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));
    resolvePlay(transport.snapshot);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("stopped"));
    expect(screen.getByRole("button", { name: "Replay" }).disabled).toBe(false);
});

it("usePlaybackTransport has one Strict Mode subscription and unmount stops active playback without disposing runtime services", async () => {
    const transport = new FakeTransport();
    let maximumSubscriptions = 0;
    const subscribe = transport.subscribe.bind(transport);
    transport.subscribe = listener => {
        const unsubscribe = subscribe(listener);
        maximumSubscriptions = Math.max(maximumSubscriptions, transport.listeners.size);
        return unsubscribe;
    };
    function Probe() { const value = usePlaybackTransport(transport); return <output>{value.state}</output>; }
    const probe = render(<StrictMode><Probe /></StrictMode>);
    expect(maximumSubscriptions).toBe(1);
    probe.unmount();
    expect(transport.listeners.size).toBe(0);

    const { runtime } = await playableRuntime({ transport });
    const view = render(<ApplicationProvider bootstrap={async () => runtime}><MusicTheoryWebApp /></ApplicationProvider>);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /generate scale/i });
    await user.click(screen.getByRole("button", { name: /generate scale/i }));
    act(() => transport.transition("playing"));
    view.unmount();
    expect(transport.stopCalls).toBe(1);
});
