import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url);

test("package exports publish Core, Web, Next, and scoped stylesheet entry points", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    assert.deepEqual(Object.keys(pkg.exports), ["./core", "./web", "./web/next", "./web/styles.css"]);
    for (const target of Object.values(pkg.exports)) assert.equal((await readFile(new URL(`..${target.slice(1)}`, import.meta.url))).length > 0, true);
    assert.equal(pkg.peerDependencies.react, pkg.devDependencies.react);
    assert.equal(pkg.peerDependencies["react-dom"], pkg.devDependencies["react-dom"]);
    assert.equal(pkg.dependencies, undefined);
});

test("reusable entries never import the standalone mount or create a root", async () => {
    const files = ["src/web/index.js", "src/web/MusicTheoryApp.jsx", "src/web/next/index.js", "src/web/next/MusicTheoryPage.jsx"];
    const source = (await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), "utf8")))).join("\n");
    assert.doesNotMatch(source, /main\.jsx|react-dom\/client|createRoot|getElementById|["']root["']/);
    assert.match(await readFile(new URL("../src/web/next/MusicTheoryPage.jsx", import.meta.url), "utf8"), /^"use client";/);
});

test("Web source entries remain safe for server module analysis", async () => {
    const files = ["src/web/index.js", "src/web/MusicTheoryApp.jsx", "src/web/next/index.js", "src/web/next/MusicTheoryPage.jsx"];
    const source = (await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), "utf8")))).join("\n");
    assert.doesNotMatch(source, /\b(?:window|document|navigator|localStorage|AudioContext|DOMParser|requestMIDIAccess)\b/);
    const script = `for (const name of ["window","document","navigator","AudioContext","DOMParser"]) Object.defineProperty(globalThis,name,{configurable:true,get(){throw new Error("forbidden "+name)}}); await import("music-theory-framework/core");`;
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd: root, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr || child.stdout);
});

test("framework CSS is scoped while responsive and print worksheet rules remain", async () => {
    const css = await readFile(new URL("../src/web/styles.css", import.meta.url), "utf8");
    assert.match(css, /\.music-theory-app/);
    assert.match(css, /@scope \(\.music-theory-app\)/);
    assert.doesNotMatch(css, /(^|\})\s*(?:html|body)\s*\{/m);
    assert.match(css, /@media \(max-width: 760px\)/);
    assert.match(css, /@media print/);
    assert.match(css, /\.worksheet-document/);
});
