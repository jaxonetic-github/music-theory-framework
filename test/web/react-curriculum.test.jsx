import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
        expect(screen.getByText("Foundations")).toBeTruthy();
        await user.selectOptions(screen.getByLabelText("Expansion scope"), "triads");
        await user.click(screen.getByRole("button", { name: "Expand Curriculum" }));
        await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
        expect(run.mock.calls[0][0].sections).toHaveLength(1);
        expect(await screen.findByRole("heading", { name: "Beginner Fundamentals" })).toBeTruthy();
        expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", { name: /play|pause|stop/i })).toBeNull();
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
