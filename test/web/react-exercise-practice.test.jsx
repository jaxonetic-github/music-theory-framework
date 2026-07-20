import React, { StrictMode, useEffect } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ExercisePracticePanel } from "../../src/web/exercise/ExercisePracticePanel.jsx";
import { useExercisePracticeWorkflow } from "../../src/web/exercise/useExercisePracticeWorkflow.js";
import { buildExerciseApplicationRequest, createInitialExercisePracticeState, transitionExercisePracticeState } from "../../src/web/exercise/workflow.js";
import { createWebApplication } from "../../src/web/bootstrap.js";
import * as Web from "../../src/web/index.js";

it("exports a frozen deliberate Web exercise namespace", () => {
    expect(typeof Web.ExercisePracticePanel).toBe("function");
    expect(typeof Web.ExercisePractice.buildExerciseApplicationRequest).toBe("function");
    expect(Web.ExercisePractice.advancedExerciseFamilyOptions.map(value => value.id)).toEqual(["approach-note", "enclosure", "chord-progression"]);
    expect(typeof Web.ExercisePractice.exerciseTargetChoices).toBe("function");
    expect(Object.isFrozen(Web.ExercisePractice)).toBe(true);
});

it("renders stable accessible controls and conditionally normalizes family and key fields", async () => {
    const runtime = await createWebApplication();
    const user = userEvent.setup();
    const run = vi.fn(request => runtime.exerciseApplication.run(request));
    const view = render(<StrictMode><ExercisePracticePanel engine={{ run }} catalogs={runtime.catalogs} /></StrictMode>);
    try {
        expect(screen.getByRole("heading", { name: "Exercise Practice" })).toBeTruthy();
        expect(screen.getByLabelText("Exercise root").value).toBe("C");
        expect(screen.getByLabelText("Exercise scale pattern")).toBeTruthy();
        expect(screen.queryByLabelText("Exercise chord quality")).toBeNull();
        await user.click(screen.getByLabelText("Blocked chord"));
        expect(screen.queryByLabelText("Exercise scale pattern")).toBeNull();
        expect(screen.getByLabelText("Exercise chord quality")).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Exercise key-signature policy"), "explicit");
        expect(screen.getByLabelText("Explicit key signature tonic")).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Exercise key-signature policy"), "none");
        expect(screen.queryByLabelText("Explicit key signature tonic")).toBeNull();
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
        await user.click(screen.getByLabelText("All keys"));
        expect(screen.queryByLabelText("Exercise root")).toBeNull();
        expect(screen.getByRole("button", { name: "Generate Exercise" })).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("announces an empty progression catalog as an accessible configuration error", async () => {
    const runtime = await createWebApplication(); const user = userEvent.setup();
    const catalogs = Object.freeze({ ...runtime.catalogs, progressions: Object.freeze([]) });
    const view = render(<ExercisePracticePanel engine={runtime.exerciseApplication} catalogs={catalogs} />);
    try {
        await user.click(screen.getByLabelText("Chord progression"));
        expect((await screen.findByRole("alert")).textContent).toMatch(/progression catalog has no compatible choices/i);
        expect(screen.getByLabelText("Scale").checked).toBe(true);
    } finally { view.unmount(); await runtime.dispose(); }
});

it("renders nine deterministic families with only the applicable advanced controls", async () => {
    const runtime = await createWebApplication(); const user = userEvent.setup();
    const view = render(<ExercisePracticePanel engine={runtime.exerciseApplication} catalogs={runtime.catalogs} />);
    try {
        expect(screen.getAllByRole("radio").map(input => input.value)).toEqual(["scale", "scale-thirds", "arpeggio-triad", "arpeggio-seventh", "chord-blocked", "chord-broken", "approach-note", "enclosure", "chord-progression"]);
        await user.click(screen.getByLabelText("Approach note"));
        expect(screen.getByRole("group", { name: "Chord target" })).toBeTruthy();
        expect(screen.getByLabelText("Exercise approach pattern").value).toBe("chromatic-below");
        expect(screen.queryByLabelText("Exercise enclosure pattern")).toBeNull(); expect(screen.queryByLabelText("Exercise chord progression")).toBeNull();
        expect(screen.queryByLabelText("Exercise direction")).toBeNull(); expect(screen.queryByLabelText("Exercise octave count")).toBeNull();
        await user.selectOptions(screen.getByLabelText("Exercise chord quality"), "major-7");
        await user.selectOptions(screen.getByLabelText("Exercise chord target"), "seventh");
        await user.selectOptions(screen.getByLabelText("Exercise chord quality"), "major");
        expect(screen.getByLabelText("Exercise chord target").value).toBe("root");
        await user.click(screen.getByLabelText("Enclosure"));
        expect(screen.getByLabelText("Exercise enclosure pattern").value).toBe("diatonic-above-chromatic-below");
        expect(screen.queryByLabelText("Exercise approach pattern")).toBeNull();
        await user.click(screen.getByLabelText("Chord progression"));
        expect(screen.getByLabelText("Exercise chord progression").value).toBe(runtime.catalogs.progressions[0].id);
        expect(screen.getByText(/ordered simultaneous chords/i)).toBeTruthy();
        for (const name of ["Exercise chord quality", "Exercise chord target", "Exercise scale pattern", "Exercise approach pattern", "Exercise enclosure pattern", "Exercise direction", "Exercise octave count"]) expect(screen.queryByLabelText(name)).toBeNull();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("generates authoritative advanced presentations with exact roots and semantic summaries", async () => {
    const runtime = await createWebApplication(); const user = userEvent.setup();
    const run = vi.fn(request => runtime.exerciseApplication.run(request));
    const view = render(<ExercisePracticePanel engine={{ run }} catalogs={runtime.catalogs} />);
    try {
        await user.click(screen.getByLabelText("Approach note"));
        await user.clear(screen.getByLabelText("Exercise root")); await user.type(screen.getByLabelText("Exercise root"), "Cb");
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        expect(await screen.findByRole("heading", { name: /Cb major approach-note/i })).toBeTruthy();
        expect(screen.getAllByText("Chromatic below").some(node => node.tagName === "DD")).toBe(true);
        await user.click(screen.getByLabelText("Enclosure"));
        await user.clear(screen.getByLabelText("Exercise root")); await user.type(screen.getByLabelText("Exercise root"), "B#");
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        expect(await screen.findByRole("heading", { name: /B# major enclosure/i })).toBeTruthy();
        expect(screen.getAllByText("Diatonic above, chromatic below").some(node => node.tagName === "DD")).toBe(true);
        await user.click(screen.getByLabelText("Chord progression"));
        for (const option of runtime.catalogs.progressions) {
            await user.selectOptions(screen.getByLabelText("Exercise chord progression"), option.id);
            await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
            expect(await screen.findByRole("heading", { name: new RegExp(option.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })).toBeTruthy();
            expect(screen.getAllByText(option.mode).some(node => node.tagName === "DD")).toBe(true);
        }
        expect(run).toHaveBeenCalledTimes(6);
        expect(screen.queryByRole("button", { name: /play|stop|replay|pause|loop|tempo/i })).toBeNull();
    } finally { view.unmount(); await runtime.dispose(); }
});

it.each([
    ["approach pattern", "Approach note", null, "Exercise approach pattern", "chromatic-above"],
    ["enclosure pattern", "Enclosure", null, "Exercise enclosure pattern", "chromatic-above-below"],
    ["target", "Approach note", ["Exercise chord quality", "major-7"], "Exercise chord target", "seventh"],
    ["progression", "Chord progression", null, "Exercise chord progression", "ii-half-diminished-v-i-minor"],
    ["chord quality", "Approach note", null, "Exercise chord quality", "minor"]
])("marks a deferred advanced completion stale after a material %s edit", async (_case, familyLabel, preparation, controlLabel, nextValue) => {
    const runtime = await createWebApplication(); const user = userEvent.setup();
    let resolvePending; const pending = new Promise(resolve => { resolvePending = resolve; });
    const family = familyLabel === "Approach note" ? "approach-note" : familyLabel === "Enclosure" ? "enclosure" : "chord-progression";
    let authoritativeState = transitionExercisePracticeState(createInitialExercisePracticeState(runtime.catalogs), { type: family }, runtime.catalogs);
    if (preparation) authoritativeState = transitionExercisePracticeState(authoritativeState, { quality: preparation[1] }, runtime.catalogs);
    const result = runtime.exerciseApplication.run(buildExerciseApplicationRequest(authoritativeState, runtime.catalogs));
    const engine = { run: vi.fn(() => pending) };
    const view = render(<ExercisePracticePanel engine={engine} catalogs={runtime.catalogs} />);
    try {
        await user.click(screen.getByLabelText(familyLabel));
        if (preparation) await user.selectOptions(screen.getByLabelText(preparation[0]), preparation[1]);
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Exercise" })); await Promise.resolve(); });
        await act(async () => { fireEvent.change(screen.getByLabelText(controlLabel), { target: { value: nextValue } }); });
        await act(async () => { resolvePending(result); await pending; });
        expect(await screen.findByText(/controls changed/i)).toBeTruthy();
        expect(screen.getByText(/controls changed/i)).toBeTruthy();
        expect(screen.getByLabelText(controlLabel).value).toBe(nextValue);
        if (_case === "approach pattern") expect(screen.getAllByText("Chromatic below").some(node => node.tagName === "DD")).toBe(true);
    } finally { view.unmount(); await runtime.dispose(); }
});

it("invokes the exercise engine once, renders every authoritative row, and marks it stale after edits", async () => {
    const runtime = await createWebApplication();
    const user = userEvent.setup();
    const run = vi.fn(request => runtime.exerciseApplication.run(request));
    const view = render(<ExercisePracticePanel engine={{ run }} catalogs={runtime.catalogs} />);
    try {
        await user.clear(screen.getByLabelText("Exercise root"));
        await user.type(screen.getByLabelText("Exercise root"), "Cb");
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
        expect(String(run.mock.calls[0][0].exercise.roots[0])).toBe("Cb");
        expect(await screen.findByRole("img", { name: /notation for Cb major/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /play|stop|replay|pause|loop/i })).toBeNull();
        await user.clear(screen.getByLabelText("Exercise root"));
        await user.type(screen.getByLabelText("Exercise root"), "B#");
        expect(screen.getByText(/controls changed/i)).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Cb major" })).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("announces workflow failures while preserving the previous completed result", async () => {
    const runtime = await createWebApplication();
    const user = userEvent.setup();
    let fail = false;
    const engine = { run(request) { if (fail) throw Object.assign(new Error("renderer unavailable"), { stage: "rendering", rowId: "row-safe-id" }); return runtime.exerciseApplication.run(request); } };
    const view = render(<ExercisePracticePanel engine={engine} catalogs={runtime.catalogs} />);
    try {
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        expect(await screen.findByRole("heading", { name: "C major" })).toBeTruthy();
        fail = true;
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("rendering stage");
        expect(alert.textContent).toContain("row-safe-id");
        expect(alert.textContent).toContain("renderer unavailable");
        expect(screen.getByRole("heading", { name: "C major" })).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("keeps a pending result stale after intervening edits, refreshes it on regeneration, and preserves staleness on failure", async () => {
    const runtime = await createWebApplication();
    const user = userEvent.setup();
    const base = createInitialExercisePracticeState(runtime.catalogs);
    const cResult = runtime.exerciseApplication.run(buildExerciseApplicationRequest(base));
    const dResult = runtime.exerciseApplication.run(buildExerciseApplicationRequest({ ...base, root: "D" }));
    let resolveFirst;
    const first = new Promise(resolve => { resolveFirst = resolve; });
    let call = 0;
    const engine = { run: vi.fn(() => {
        call += 1;
        if (call === 1) return first;
        if (call === 2) return dResult;
        throw Object.assign(new Error("later request failed"), { stage: "generation" });
    }) };
    const view = render(<ExercisePracticePanel engine={engine} catalogs={runtime.catalogs} />);
    try {
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Exercise" })); await Promise.resolve(); });
        expect(screen.getByRole("button", { name: /generating exercise/i }).disabled).toBe(true);
        const root = screen.getByLabelText("Exercise root");
        await act(async () => { fireEvent.change(root, { target: { value: "D" } }); });
        await act(async () => { resolveFirst(cResult); await first; });
        expect(await screen.findByRole("heading", { name: "C major" })).toBeTruthy();
        expect(screen.getByText(/controls changed/i)).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        expect(await screen.findByRole("heading", { name: "D major" })).toBeTruthy();
        expect(screen.queryByText(/controls changed/i)).toBeNull();

        await user.clear(screen.getByLabelText("Exercise root"));
        await user.type(screen.getByLabelText("Exercise root"), "E");
        expect(screen.getByText(/controls changed/i)).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Generate Exercise" }));
        expect((await screen.findByRole("alert")).textContent).toContain("later request failed");
        expect(screen.getByRole("heading", { name: "D major" })).toBeTruthy();
        expect(screen.getByText(/controls changed/i)).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

function HookProbe({ engine, requests, onWorkflow }) {
    const value = useExercisePracticeWorkflow(engine);
    useEffect(() => { onWorkflow(value); });
    return <output data-testid="hook-state">{value.workflow.result?.request.identity ?? value.workflow.workflowError?.message ?? (value.workflow.busy ? "busy" : "empty")}</output>;
}

it("ignores stale success and stale failure and performs no update after unmount", async () => {
    const runtime = await createWebApplication();
    const base = createInitialExercisePracticeState(runtime.catalogs);
    const firstRequest = buildExerciseApplicationRequest(base);
    const secondRequest = buildExerciseApplicationRequest({ ...base, root: "D" });
    const firstResult = runtime.exerciseApplication.run(firstRequest);
    const secondResult = runtime.exerciseApplication.run(secondRequest);
    let resolveFirst, rejectThird;
    const first = new Promise(resolve => { resolveFirst = resolve; });
    const third = new Promise((resolve, reject) => { rejectThird = reject; });
    const engine = { run: vi.fn(request => request === firstRequest ? first : request === secondRequest ? Promise.resolve(secondResult) : third) };
    let hook;
    const view = render(<HookProbe engine={engine} onWorkflow={value => { hook = value; }} />);
    try {
        await act(async () => { void hook.run(firstRequest).catch(() => {}); });
        await act(async () => { await hook.run(secondRequest); });
        expect(screen.getByTestId("hook-state").textContent).toBe(secondRequest.identity);
        await act(async () => { resolveFirst(firstResult); await first; });
        expect(screen.getByTestId("hook-state").textContent).toBe(secondRequest.identity);
        const thirdRequest = buildExerciseApplicationRequest({ ...base, root: "E" });
        await act(async () => { void hook.run(thirdRequest).catch(() => {}); });
        view.unmount();
        await act(async () => { rejectThird(new Error("late failure")); try { await third; } catch {} });
    } finally { if (view.container.isConnected) view.unmount(); await runtime.dispose(); }
});
