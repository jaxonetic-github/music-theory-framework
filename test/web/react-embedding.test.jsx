import React, { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createWebApplication } from "../../src/web/bootstrap.js";
import { MusicTheoryApp } from "../../src/web/MusicTheoryApp.jsx";
import MusicTheoryPage, { MusicTheoryPage as NamedMusicTheoryPage } from "../../src/web/next/index.js";
import * as Web from "../../src/web/index.js";

it("exports and renders the complete self-providing application with a caller class", async () => {
    const runtimes = [];
    const factory = vi.fn(async () => { const runtime = await createWebApplication(); runtimes.push(runtime); return runtime; });
    const view = render(<MusicTheoryApp className="host-embed" runtimeFactory={factory} />);
    expect((await screen.findByRole("heading", { name: "Exercise Practice" })).closest(".music-theory-app").classList.contains("host-embed")).toBe(true);
    expect(screen.getByRole("heading", { name: "Exercise Set Worksheet" })).toBeTruthy();
    expect(Web.MusicTheoryApp).toBe(MusicTheoryApp);
    view.unmount();
    await waitFor(() => expect(runtimes[0].transport.snapshot.state).toBe("idle"));
});

it("borrows an explicit runtime without disposing it", async () => {
    const runtime = await createWebApplication();
    const borrowedDispose = vi.fn();
    const borrowed = Object.freeze({ ...runtime, dispose: borrowedDispose });
    const view = render(<MusicTheoryApp runtime={borrowed} />);
    await screen.findByRole("heading", { name: "Exercise Practice" });
    view.unmount();
    expect(borrowedDispose).not.toHaveBeenCalled();
    expect(runtime.application.run).toBeTypeOf("function");
    expect(runtime.transport.snapshot.state).toBe("idle");
    await runtime.dispose();
});

it("creates isolated runtimes and unique IDs for multiple embedded instances", async () => {
    const runtimes = [];
    const factory = async () => { const runtime = await createWebApplication(); runtimes.push(runtime); return runtime; };
    const view = render(<><MusicTheoryApp runtimeFactory={factory} /><MusicTheoryApp runtimeFactory={factory} /></>);
    await waitFor(() => expect(runtimes).toHaveLength(2));
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "Exercise Practice" })).toHaveLength(2));
    expect(runtimes[0]).not.toBe(runtimes[1]);
    const ids = [...view.container.querySelectorAll("[id]")].map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    view.unmount();
});

it("cleans Strict Mode-owned runtimes and reports initialization failure", async () => {
    const disposals = [];
    const factory = vi.fn(async () => {
        const runtime = await createWebApplication(), dispose = vi.fn(() => runtime.dispose());
        disposals.push(dispose);
        return Object.freeze({ ...runtime, dispose });
    });
    const view = render(<StrictMode><MusicTheoryApp runtimeFactory={factory} /></StrictMode>);
    await screen.findByRole("heading", { name: "Exercise Practice" });
    view.unmount();
    await waitFor(() => expect(disposals.every(dispose => dispose.mock.calls.length === 1)).toBe(true));
    render(<MusicTheoryApp runtimeFactory={async () => { throw new Error("fixture bootstrap failed"); }} />);
    expect((await screen.findByRole("alert")).textContent).toContain("fixture bootstrap failed");
});

it("MusicTheoryPage is the documented client wrapper and forwards application props", async () => {
    expect(MusicTheoryPage).toBe(NamedMusicTheoryPage);
    const runtime = await createWebApplication();
    const view = render(<MusicTheoryPage runtime={runtime} className="next-page" />);
    const root = (await screen.findByRole("heading", { name: "Exercise Practice" })).closest(".music-theory-app");
    expect(root.classList.contains("next-page")).toBe(true);
    view.unmount();
    await runtime.dispose();
});
