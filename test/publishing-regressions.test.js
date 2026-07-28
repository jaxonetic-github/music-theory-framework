import test from "node:test";
import assert from "node:assert/strict";
import {
    ExportModule, ExerciseApplicationModule, ExerciseModule, ExerciseNotationModule,
    ExerciseSetModule, Kernel, LayoutModule, NotationModule, PublishingModule,
    RenderingModule, TheoryModule, layoutPublicationText, measurePublicationText,
    trustedSvgPdfOperations
} from "../src/core/index.js";

async function fixture() {
    const layout = new LayoutModule();
    const kernel = new Kernel()
        .use(new TheoryModule()).use(new NotationModule()).use(layout)
        .use(new RenderingModule({ layoutEngine: layout.engine }))
        .use(new ExerciseModule()).use(new ExerciseNotationModule())
        .use(new ExerciseApplicationModule()).use(new ExerciseSetModule())
        .use(new ExportModule()).use(new PublishingModule());
    await kernel.start();
    const source = kernel.services.resolve("exercise.set.application").run({
        title: "Sections",
        sections: [
            { id: "section-a", title: "Section A", items: [{ id: "a", label: "A", application: { exercise: { type: "scale", root: "C" }, rendering: { format: "svg" } } }] },
            { id: "section-b", title: "Section B", items: [{ id: "b", label: "B", application: { exercise: { type: "scale", root: "D" }, rendering: { format: "svg" } } }] }
        ]
    });
    return { kernel, source, engine: kernel.services.resolve("publishing.engine") };
}
const header = page => page.blocks.find(block => block.type === "header")?.text;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;

test("section headers are captured per page before the next section changes planner state", async () => {
    const { kernel, source, engine } = await fixture();
    const result = engine.publish({ source, format: "html", headerPolicy: "section-title", sectionBreakPolicy: "new-page" });
    const pageA = result.plan.pages.find(page => page.blocks.some(block => block.source.sectionId === "section-a"));
    const pageB = result.plan.pages.find(page => page.blocks.some(block => block.source.sectionId === "section-b"));
    assert.equal(header(pageA), "Section A");
    assert.equal(header(pageB), "Section B");
    assert.equal(pageA.metadata.headerContext.text, "Section A");
    assert.equal(Object.isFrozen(pageA.metadata.headerContext), true);
    assert.equal(engine.publish({ source, format: "html", headerPolicy: "none" }).plan.pages.some(page => header(page)), false);
    assert.equal(header(engine.publish({ source, format: "html", headerPolicy: "document-title", sectionBreakPolicy: "new-page" }).plan.pages[1]), "Sections");
    await kernel.dispose();
});

test("a mid-page section transition retains the section active at page start", async () => {
    const { kernel, source, engine } = await fixture();
    const result = engine.publish({ source, format: "html", headerPolicy: "section-title", sectionBreakPolicy: "flow" });
    const transitionPage = result.plan.pages.find(page => page.blocks.some(block => block.source.sectionId === "section-b" && block.type === "section-heading"));
    assert.equal(header(transitionPage), "Sections");
    assert.ok(transitionPage.blocks.some(block => block.type === "section-heading" && block.text === "Section B"));
    await kernel.dispose();
});

test("canonical publication wrapping is immutable, newline-aware, and bounded", () => {
    const long = "Play   every scale\n\nSupercalifragilisticexpialidocious ♭ ♯ ♮";
    const layout = layoutPublicationText({ text: long, availableWidth: 5200, category: "instructions" });
    assert.equal(Object.isFrozen(layout), true);
    assert.equal(Object.isFrozen(layout.lines), true);
    assert.ok(layout.lineCount > 3);
    assert.ok(layout.lines.every(line => line.width <= layout.availableWidth && Object.isFrozen(line)));
    assert.ok(layout.lines.some(line => line.text === ""));
    const exact = measurePublicationText("Exact", 1000);
    assert.equal(layoutPublicationText({ text: "Exact", availableWidth: exact, typography: { fontSize: 1000, lineHeight: 1200, weight: 400 } }).lineCount, 1);
    assert.ok(layoutPublicationText({ text: "Exact", availableWidth: exact - 1, typography: { fontSize: 1000, lineHeight: 1200, weight: 400 } }).lineCount > 1);
});

test("SVG, HTML, and PDF consume the same planned wrapped line sequence", async () => {
    const { kernel, source, engine } = await fixture();
    const instructions = "Name every written accidental and continue through the complete line without changing the exact rhythm. ".repeat(8);
    const html = engine.publish({ source, format: "html", instructions });
    const svgResult = engine.publish({ source, format: "svg", instructions });
    const pdf = engine.publish({ source, format: "pdf", instructions });
    const block = html.plan.blocks.find(value => value.type === "instructions");
    assert.ok(block.metadata.textLayout.lineCount > 1);
    assert.equal((html.document.assets[0].content.match(/class="publication-line"/g) ?? []).length, html.plan.blocks.filter(value => value.type !== "notation").reduce((sum, value) => sum + value.metadata.textLayout.lineCount, 0));
    assert.equal((svgResult.document.assets.map(asset => asset.content).join("").match(/<tspan\b/g) ?? []).length, svgResult.plan.blocks.filter(value => value.type !== "notation").reduce((sum, value) => sum + value.metadata.textLayout.lineCount, 0));
    const pdfText = new TextDecoder("latin1").decode(pdf.document.assets[0].content);
    for (const line of block.metadata.textLayout.lines.filter(value => value.text)) assert.match(pdfText, new RegExp(`\\(${line.text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\) Tj`));
    await kernel.dispose();
});

test("PDF SVG traversal inherits paint through nested groups without sibling leakage", () => {
    const converted = trustedSvgPdfOperations(svg(`
      <g color="black" fill="currentColor" opacity="0.5">
        <g fill-rule="evenodd"><path d="M1 1h8v8z"/></g>
        <path d="M20 1h8v8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g fill="white"><circle cx="40" cy="10" r="4" stroke="none"/></g>
      <line x1="1" y1="20" x2="20" y2="20" stroke="currentColor"/>
      <text x="1" y="30" font-size="12">Bass &amp; staff</text>
    `));
    assert.equal(converted.operations.length, 5);
    assert.match(converted.operations[0], /0 0 0 rg[\s\S]*f\*/);
    assert.match(converted.operations[1], /0 0 0 RG[\s\S]* S$/);
    assert.match(converted.operations[2], /1 1 1 rg[\s\S]* f$/);
    assert.match(converted.operations[3], /0 0 0 RG[\s\S]* S$/);
    assert.ok(converted.operations[4].includes("(Bass & staff) Tj"));
    assert.match(converted.operations[1], /1 J 1 j/);
    assert.ok(converted.graphicsStates.some(value => value.alpha === "0.5:0.5"));
});

test("PDF SVG traversal supports direct overrides, combined paint, none, and rejects unsupported visible constructs", () => {
    const operations = trustedSvgPdfOperations(svg(`
      <path d="M1 1h8v8z" fill="black"/>
      <path d="M11 1h8v8z" fill="none" stroke="black"/>
      <path d="M21 1h8v8z" fill="black" stroke="black" opacity="0.25"/>
      <g fill="black"><path d="M31 1h8v8z" fill="white"/></g>
    `)).operations;
    assert.match(operations[0], / f$/);
    assert.match(operations[1], / S$/);
    assert.match(operations[2], / B$/);
    assert.match(operations[3], /1 1 1 rg[\s\S]* f$/);
    assert.throws(() => trustedSvgPdfOperations(svg(`<rect x="0" y="0" width="10" height="10"/>`)), /does not support/);
    assert.throws(() => trustedSvgPdfOperations("<svg><script/></svg>"), /trusted SVG/);
});
