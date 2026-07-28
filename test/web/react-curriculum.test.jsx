import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { createWebApplication } from "../../src/web/bootstrap.js";
import { CurriculumBrowser } from "../../src/web/curriculum/CurriculumBrowser.jsx";
import * as Web from "../../src/web/index.js";

it("exports the Curriculum workflow and obtains choices from active Core catalogs", async () => {
    const runtime = await createWebApplication();
    try {
        expect(typeof Web.CurriculumBrowser).toBe("function");
        expect(typeof runtime.curriculumEngine.expandTemplate).toBe("function");
        expect(runtime.catalogs.templates).toHaveLength(12);
        expect(runtime.catalogs.curricula).toHaveLength(3);
        expect(Object.isFrozen(runtime.catalogs.templates)).toBe(true);
        const scale = runtime.catalogs.templates.find(value => value.id === "melodic-minor-scales");
        expect(scale.parameters.find(value => value.id === "pattern").choices.map(value => value.id))
            .toEqual(runtime.catalogs.scales.map(value => value.id));
    } finally { await runtime.dispose(); }
});

it("browses and filters templates with fixed constraints separated from editable controls", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={runtime.exerciseSetApplication} catalogs={runtime.catalogs}/>);
    try {
        expect(screen.getByRole("tab", { name: "Templates" }).getAttribute("aria-selected")).toBe("true");
        await user.selectOptions(screen.getByLabelText("Template"), "core.curriculum.builtins:major-scales-canonical");
        expect(screen.getByText("major")).toBeTruthy();
        expect(screen.getAllByText("(fixed)").length).toBeGreaterThan(0);
        expect(screen.getByLabelText("Direction")).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Difficulty"), "advanced");
        expect(screen.getByRole("option", { name: "Chromatic approach notes by target" })).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Skill or tag"), "blues");
        expect(screen.getByRole("option", { name: "Twelve-bar dominant blues" })).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Family"), "scale");
        expect(screen.getByText("No templates match these filters.")).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("inspects curriculum structure and expands a selected lesson through the worksheet application", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const run = vi.fn(request => runtime.exerciseSetApplication.run(request));
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={{ run }} catalogs={runtime.catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await user.selectOptions(screen.getByLabelText("Curriculum"), "core.curriculum.builtins:beginner-fundamentals");
        expect(screen.getByRole("heading", { name: "Beginner Fundamentals" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Foundations" })).toBeTruthy();
        await user.selectOptions(screen.getByLabelText(/^Unit scope/), "foundations");
        await user.selectOptions(screen.getByLabelText("Lesson scope for Foundations"), JSON.stringify(["foundations", "triads"]));
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
        expect(run.mock.calls[0][0].sections).toHaveLength(1);
        expect(await screen.findByRole("heading", { name: "Beginner Fundamentals" })).toBeTruthy();
        expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", { name: /play|pause|stop/i })).toBeNull();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("scopes duplicate lesson IDs to the selected unit and normalizes lesson state on unit changes", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const duplicate = {
        id: "duplicate-lessons", pluginId: "test.curriculum", key: "test.curriculum:duplicate-lessons",
        title: "Duplicate lessons", description: "Scoped identities.", objective: "Select precisely.",
        difficulty: "beginner", tags: [], prerequisites: [], version: "1.0.0",
        units: ["unit-a", "unit-b"].map((unitId, index) => ({
            id: unitId, title: `Unit ${index + 1}`, objective: `Unit objective ${index + 1}`,
            lessons: [{ id: "lesson-1", title: "Shared lesson", objective: `Lesson objective ${index + 1}`, prerequisites: [], templateIds: ["major-triad-arpeggios"] }]
        }))
    };
    const catalogs = Object.freeze({ ...runtime.catalogs, curricula: Object.freeze([duplicate]) });
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={runtime.exerciseSetApplication} catalogs={catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await user.selectOptions(await screen.findByLabelText(/^Unit scope/), "unit-a");
        const first = await screen.findByLabelText("Lesson scope for Unit 1");
        await user.selectOptions(first, JSON.stringify(["unit-a", "lesson-1"]));
        expect(first.value).toBe(JSON.stringify(["unit-a", "lesson-1"]));
        await user.selectOptions(screen.getByLabelText(/^Unit scope/), "unit-b");
        const second = await screen.findByLabelText("Lesson scope for Unit 2");
        expect(second.value).toBe(JSON.stringify(["unit-b", "lesson-1"]));
        expect(screen.getByRole("option", { name: "Shared lesson (Unit 2)" }).value).toBe(JSON.stringify(["unit-b", "lesson-1"]));
    } finally { view.unmount(); await runtime.dispose(); }
});

it("marks a successful worksheet stale after material edits and preserves it after failure", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    let calls = 0;
    const application = { run(request) {
        calls += 1;
        if (calls > 1) throw new Error("new expansion failed");
        return runtime.exerciseSetApplication.run(request);
    } };
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={application} catalogs={runtime.catalogs}/>);
    try {
        await user.selectOptions(screen.getByLabelText("Template"), "core.curriculum.builtins:melodic-minor-scales");
        await user.click(screen.getByRole("button", { name: "Expand Template" }));
        expect(await screen.findByText("Curriculum worksheet ready.")).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Direction"), "descending");
        expect(screen.getByText(/Draft changed/)).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Expand Template" }));
        expect((await screen.findByRole("alert")).textContent).toContain("new expansion failed");
        expect(screen.getByText(/Draft changed/)).toBeTruthy();
        expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
    } finally { view.unmount(); await runtime.dispose(); }
});

it("treats only real mode changes as material and retains authoritative results as stale", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={runtime.exerciseSetApplication} catalogs={runtime.catalogs}/>);
    try {
        await user.selectOptions(screen.getByLabelText("Template"), "core.curriculum.builtins:melodic-minor-scales");
        await user.click(screen.getByRole("button", { name: "Expand Template" }));
        expect((await screen.findAllByRole("heading", { name: "Melodic minor scales" })).length).toBeGreaterThan(1);
        await user.click(screen.getByRole("tab", { name: "Templates" }));
        expect(screen.queryByText(/Draft changed/)).toBeNull();
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        expect(screen.getAllByRole("heading", { name: "Melodic minor scales" }).length).toBeGreaterThan(0);
        expect(screen.getByText(/Draft changed/)).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Curricula" }).getAttribute("aria-selected")).toBe("true");
        await user.selectOptions(screen.getByLabelText("Curriculum"), "core.curriculum.builtins:beginner-fundamentals");
        await user.selectOptions(screen.getByLabelText(/^Unit scope/), "foundations");
        await user.selectOptions(screen.getByLabelText("Lesson scope for Foundations"), JSON.stringify(["foundations", "major-scales"]));
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        expect((await screen.findAllByRole("heading", { name: "Major scales" })).length).toBeGreaterThan(1);
        expect(screen.queryByText(/Draft changed/)).toBeNull();
        await user.click(screen.getByRole("tab", { name: "Templates" }));
        expect(screen.getAllByRole("heading", { name: "Major scales" }).length).toBeGreaterThan(0);
        expect(screen.getByText(/Draft changed/)).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("ignores a pending completion after switching modes", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    let resolvePending;
    const pending = new Promise(resolve => { resolvePending = resolve; });
    const completed = runtime.exerciseSetApplication.run(runtime.curriculumEngine.expandTemplate({ templateId: "melodic-minor-scales" }).exerciseSetRequest);
    const application = { run: vi.fn(() => pending) };
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={application} catalogs={runtime.catalogs}/>);
    try {
        await user.selectOptions(screen.getByLabelText("Template"), "core.curriculum.builtins:melodic-minor-scales");
        await user.click(screen.getByRole("button", { name: "Expand Template" }));
        await waitFor(() => expect(application.run).toHaveBeenCalledTimes(1));
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await act(async () => { resolvePending(completed); await pending; });
        expect(screen.queryByRole("heading", { name: "Melodic minor scales" })).toBeNull();
        expect(screen.getByRole("tab", { name: "Curricula" }).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByText("Create and generate a worksheet to see it here.")).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("ignores a pending curriculum completion after switching to templates", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    let resolvePending;
    const pending = new Promise(resolve => { resolvePending = resolve; });
    const expansion = runtime.curriculumEngine.expandCurriculum({ curriculumId: "beginner-fundamentals", unitId: "foundations", lessonId: "major-scales" });
    const completed = runtime.exerciseSetApplication.run(expansion.exerciseSetRequest);
    const application = { run: vi.fn(() => pending) };
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={application} catalogs={runtime.catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await user.selectOptions(screen.getByLabelText("Curriculum"), "core.curriculum.builtins:beginner-fundamentals");
        await user.selectOptions(screen.getByLabelText(/^Unit scope/), "foundations");
        await user.selectOptions(screen.getByLabelText("Lesson scope for Foundations"), JSON.stringify(["foundations", "major-scales"]));
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        await waitFor(() => expect(application.run).toHaveBeenCalledTimes(1));
        await user.click(screen.getByRole("tab", { name: "Templates" }));
        await act(async () => { resolvePending(completed); await pending; });
        expect(screen.queryByRole("heading", { name: "Major scales" })).toBeNull();
        expect(screen.getByRole("tab", { name: "Templates" }).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByText("Create and generate a worksheet to see it here.")).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("preserves the prior stale success when generation fails in the new mode", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    let fail = false;
    const application = { run: vi.fn(request => fail ? Promise.reject(new Error("curriculum generation failed")) : runtime.exerciseSetApplication.run(request)) };
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={application} catalogs={runtime.catalogs}/>);
    try {
        await user.selectOptions(screen.getByLabelText("Template"), "core.curriculum.builtins:melodic-minor-scales");
        await user.click(screen.getByRole("button", { name: "Expand Template" }));
        expect((await screen.findAllByRole("heading", { name: "Melodic minor scales" })).length).toBeGreaterThan(1);
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        fail = true;
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        expect((await screen.findByRole("alert")).textContent).toContain("curriculum generation failed");
        expect(screen.getAllByRole("heading", { name: "Melodic minor scales" }).length).toBeGreaterThan(0);
        expect(screen.getByText(/Draft changed/)).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("normalizes curriculum scope when filters exclude the selection or produce no matches", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const run = vi.fn(request => runtime.exerciseSetApplication.run(request));
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={{run}} catalogs={runtime.catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await user.selectOptions(screen.getByLabelText("Curriculum"), "core.curriculum.builtins:beginner-fundamentals");
        await user.selectOptions(screen.getByLabelText("Lesson scope for Foundations"), JSON.stringify(["foundations","triads"]));
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        expect(await screen.findByText("Curriculum worksheet ready.")).toBeTruthy();

        await user.selectOptions(screen.getByLabelText("Difficulty"), "intermediate");
        expect(screen.getByLabelText("Curriculum").value).toBe("core.curriculum.builtins:intermediate-harmony");
        expect(screen.getByLabelText(/^Unit scope/).value).toBe("seventh-harmony");
        expect(screen.getByLabelText("Lesson scope for Seventh harmony").value).toBe(JSON.stringify(["seventh-harmony","thirds-and-sevenths"]));
        expect(screen.getByText(/Draft changed/)).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        expect(await screen.findByText("Curriculum worksheet ready.")).toBeTruthy();
        expect(run).toHaveBeenCalledTimes(2);

        await user.selectOptions(screen.getByLabelText("Skill or tag"), "harmony");
        expect(screen.queryByText(/Draft changed/)).toBeNull();
        await user.selectOptions(screen.getByLabelText("Difficulty"), "beginner");
        expect(screen.getByText("No curricula match these filters.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Expand Curriculum" }).disabled).toBe(true);
        expect(screen.getByText(/Draft changed/)).toBeTruthy();

        await user.selectOptions(screen.getByLabelText("Skill or tag"), "all");
        expect(screen.getByLabelText("Curriculum").value).toBe("core.curriculum.builtins:beginner-fundamentals");
        expect(screen.getByLabelText(/^Unit scope/).value).toBe("foundations");
        expect(screen.getByLabelText("Lesson scope for Foundations").value).toBe(JSON.stringify(["foundations","major-scales"]));
    } finally { view.unmount(); await runtime.dispose(); }
});

it("invalidates pending curriculum completion when filtering changes effective selection", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    let resolvePending;
    const pending = new Promise(resolve => { resolvePending = resolve; });
    const completed = runtime.exerciseSetApplication.run(runtime.curriculumEngine.expandCurriculum({curriculumId:"advanced-language",unitId:"chromatic-language",lessonId:"targets"}).exerciseSetRequest);
    const application = { run:vi.fn(() => pending) };
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={application} catalogs={runtime.catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        await waitFor(() => expect(application.run).toHaveBeenCalledTimes(1));
        await user.selectOptions(screen.getByLabelText("Difficulty"), "beginner");
        await act(async () => { resolvePending(completed); await pending; });
        expect(screen.queryByRole("heading", { name: "Approaches and enclosures" })).toBeNull();
        expect(screen.getByLabelText("Curriculum").value).toBe("core.curriculum.builtins:beginner-fundamentals");
        expect(screen.getByText("Create and generate a worksheet to see it here.")).toBeTruthy();
    } finally { view.unmount(); await runtime.dispose(); }
});

it("normalizes template parameters when filters change the effective template", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={runtime.exerciseSetApplication} catalogs={runtime.catalogs}/>);
    try {
        await user.selectOptions(screen.getByLabelText("Template"), "core.curriculum.builtins:melodic-minor-scales");
        await user.selectOptions(screen.getByLabelText("Direction"), "descending");
        await user.selectOptions(screen.getByLabelText("Difficulty"), "beginner");
        expect(screen.getByLabelText("Template").value).toBe("core.curriculum.builtins:major-scales-canonical");
        expect(screen.getByLabelText("Direction").value).toBe("ascending");
        await user.selectOptions(screen.getByLabelText("Family"), "approach-note");
        expect(screen.getByText("No templates match these filters.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Expand Template" }).disabled).toBe(true);
    } finally { view.unmount(); await runtime.dispose(); }
});

it("invalidates pending completion when curriculum filters enter a no-match state", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    let resolvePending;
    const pending = new Promise(resolve => { resolvePending = resolve; });
    const completed = runtime.exerciseSetApplication.run(runtime.curriculumEngine.expandCurriculum({curriculumId:"advanced-language",unitId:"chromatic-language",lessonId:"targets"}).exerciseSetRequest);
    const application = { run:vi.fn(() => pending) };
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={application} catalogs={runtime.catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        await waitFor(() => expect(application.run).toHaveBeenCalledTimes(1));
        await user.selectOptions(screen.getByLabelText("Difficulty"), "advanced");
        await user.selectOptions(screen.getByLabelText("Skill or tag"), "fundamentals");
        expect(screen.getByText("No curricula match these filters.")).toBeTruthy();
        await act(async () => { resolvePending(completed); await pending; });
        expect(screen.queryByRole("heading", { name: "Approaches and enclosures" })).toBeNull();
        expect(screen.getByRole("button", { name: "Expand Curriculum" }).disabled).toBe(true);
    } finally { view.unmount(); await runtime.dispose(); }
});

it("normalizes safely when an active catalog replacement removes the selection", async () => {
    const runtime = await createWebApplication(), user = userEvent.setup();
    const view = render(<CurriculumBrowser engine={runtime.curriculumEngine} application={runtime.exerciseSetApplication} catalogs={runtime.catalogs}/>);
    try {
        await user.click(screen.getByRole("tab", { name: "Curricula" }));
        expect(screen.getByLabelText("Curriculum").value).toBe("core.curriculum.builtins:advanced-language");
        const beginner = runtime.catalogs.curricula.find(value => value.id === "beginner-fundamentals");
        const replacement = Object.freeze({...runtime.catalogs,curricula:Object.freeze([beginner])});
        view.rerender(<CurriculumBrowser engine={runtime.curriculumEngine} application={runtime.exerciseSetApplication} catalogs={replacement}/>);
        await waitFor(() => expect(screen.getByLabelText("Curriculum").value).toBe("core.curriculum.builtins:beginner-fundamentals"));
        expect(screen.getByLabelText(/^Unit scope/).value).toBe("foundations");
        expect(screen.getByLabelText("Lesson scope for Foundations").value).toBe(JSON.stringify(["foundations","major-scales"]));
    } finally { view.unmount(); await runtime.dispose(); }
});
