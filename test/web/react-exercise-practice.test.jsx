import React, { StrictMode, useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ExercisePracticePanel } from "../../src/web/exercise/ExercisePracticePanel.jsx";
import { useExercisePracticeWorkflow } from "../../src/web/exercise/useExercisePracticeWorkflow.js";
import { buildExerciseApplicationRequest, createInitialExercisePracticeState } from "../../src/web/exercise/workflow.js";
import { createWebApplication } from "../../src/web/bootstrap.js";
import * as Web from "../../src/web/index.js";

it("exports a frozen deliberate Web exercise namespace", () => {
    expect(typeof Web.ExercisePracticePanel).toBe("function");
    expect(typeof Web.ExercisePractice.buildExerciseApplicationRequest).toBe("function");
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
        await user.click(screen.getByLabelText("All keys"));
        expect(screen.queryByLabelText("Exercise root")).toBeNull();
        expect(screen.getByRole("button", { name: "Generate Exercise" })).toBeTruthy();
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
