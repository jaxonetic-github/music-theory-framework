import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApplicationWorkflowError } from "../../src/core/index.js";
import { ApplicationProvider, useApplicationRuntime, useApplicationWorkflow } from "../../src/web/ApplicationProvider.jsx";
import { MusicTheoryWebApp } from "../../src/web/MusicTheoryWebApp.jsx";
import { createWebApplication } from "../../src/web/bootstrap.js";

const catalogs = Object.freeze({
    scales: Object.freeze([{ id: "major", name: "Major" }, { id: "dorian", name: "Dorian" }]),
    chords: Object.freeze([{ id: "major", name: "Major" }, { id: "minor-7", name: "Minor Seventh" }])
});

function bootstrapWith(application, dispose = vi.fn(async () => {})) {
    return vi.fn(async () => Object.freeze({ application, catalogs, dispose }));
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
