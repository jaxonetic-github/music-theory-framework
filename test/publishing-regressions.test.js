import test from "node:test";
import assert from "node:assert/strict";
import {
    ExportModule, ExerciseApplicationModule, ExerciseModule, ExerciseNotationModule,
    ExerciseSetModule, Kernel, LayoutModule, NotationModule, PageProfile, PdfPublishingStrategy,
    PublicationBlock, PublicationPage, PublicationPlan, PublishingModule, RenderingModule, TheoryModule,
    formatPublishingPoints, layoutPublicationText, measurePublicationText, parseSvgTransform,
    trustedSvgPdfOperations
} from "../src/core/index.js";

async function fixture({ semanticSummary = false, curriculum = false } = {}) {
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
            { id: "section-b", title: "Section B", ...(curriculum ? { label: "Unit Two", metadata: { curriculumPluginId: "curriculum.test", curriculumId: "course", unitId: "unit-2", lessonId: "lesson-2" } } : {}), items: [{ id: "b", label: "B", metadata: { ...(semanticSummary ? { semanticSummary: "Name the written pitches before playing." } : {}), ...(curriculum ? { curriculumPluginId: "curriculum.test", curriculumId: "course", unitId: "unit-2", lessonId: "lesson-2", templateId: "major-scales" } : {}) }, application: { exercise: { type: "scale", root: "D" }, rendering: { format: "svg" } } }] }
        ]
    });
    return { kernel, source, engine: kernel.services.resolve("publishing.engine") };
}
const header = page => page.blocks.find(block => block.type === "header")?.text;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;
const shortPage = (height, id = `short-${height}`) => new PageProfile({ id, name: id, width: 61200, height, orientation: "landscape", minimumContentHeight: 1 });

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

test("minimum heading chains paginate atomically through the first notation system", async () => {
    const { kernel, source, engine } = await fixture();
    const exact = engine.publish({ source, format: "html", headerPolicy: "section-title", pageProfile: shortPage(50812, "exact-chain") });
    assert.equal(exact.plan.pageCount, 1);
    const exactSection = exact.plan.pages[0].blocks.filter(block => block.source.sectionId === "section-b").map(block => block.type);
    assert.deepEqual(exactSection, ["section-heading", "item-heading", "notation"]);
    const oneUnitOver = engine.publish({ source, format: "html", headerPolicy: "section-title", pageProfile: shortPage(50811, "one-unit-over") });
    const sectionPages = oneUnitOver.plan.pages.filter(page => page.blocks.some(block => block.source.sectionId === "section-b"));
    assert.equal(sectionPages.length, 1);
    assert.deepEqual(sectionPages[0].blocks.filter(block => block.source.sectionId === "section-b" && ["section-heading", "item-heading", "notation"].includes(block.type)).map(block => block.type), ["section-heading", "item-heading", "notation"]);
    assert.notEqual(sectionPages[0].number, 1);
    assert.notEqual(header(oneUnitOver.plan.pages[0]), "Section B");
    assert.equal(header(sectionPages[0]), "Section B");
    assert.equal(Object.isFrozen(oneUnitOver.plan.metadata.keepGroups), true);
    assert.ok(oneUnitOver.plan.metadata.keepGroups.every(Object.isFrozen));
    const repeated = engine.publish({ source, format: "html", headerPolicy: "section-title", pageProfile: shortPage(50811, "one-unit-over") });
    assert.deepEqual(repeated.plan.pages.map(page => page.blocks.map(block => block.id)), oneUnitOver.plan.pages.map(page => page.blocks.map(block => block.id)));
    assert.deepEqual(repeated.plan.metadata.keepGroups, oneUnitOver.plan.metadata.keepGroups);
    await kernel.dispose();
});

test("section headings never remain where only the heading fits", async () => {
    const { kernel, source, engine } = await fixture();
    const result = engine.publish({ source, format: "html", headerPolicy: "section-title", pageProfile: shortPage(37006, "heading-only-room") });
    const sectionPages = result.plan.pages.filter(page => page.blocks.some(block => block.source.sectionId === "section-b"));
    assert.equal(sectionPages.length, 1);
    assert.deepEqual(sectionPages[0].blocks.filter(block => block.source.sectionId === "section-b" && ["section-heading", "item-heading", "notation"].includes(block.type)).map(block => block.type), ["section-heading", "item-heading", "notation"]);
    await kernel.dispose();
});

test("semantic and curriculum heading chains participate in the same transitive keep group", async () => {
    const { kernel, source, engine } = await fixture({ semanticSummary: true, curriculum: true });
    const result = engine.publish({ source, format: "html", headerPolicy: "section-title", pageProfile: shortPage(56000, "curriculum-chain") });
    const group = result.plan.metadata.keepGroups.find(value => value.blockTypes.includes("unit-heading"));
    assert.deepEqual(group.blockTypes, ["unit-heading", "section-heading", "item-heading", "semantic-summary", "notation"]);
    const page = result.plan.pages.find(value => value.number === group.pageNumber);
    for (const type of group.blockTypes) assert.ok(page.blocks.some(block => block.type === type && block.source.sectionId === "section-b"));
    assert.equal(header(page), "Section B");
    await kernel.dispose();
});

test("oversized introductory keep groups reject with complete source context", async () => {
    const { kernel, source, engine } = await fixture();
    assert.throws(() => engine.publish({ source, format: "html", pageProfile: shortPage(28400, "oversized-chain") }), /keep group.*section "section-a".*item "a".*row .*systems/);
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

test("authoritative print HTML emits exact built-in and custom page geometry", async () => {
    const { kernel, source, engine } = await fixture();
    const profiles = [
        ["letter-portrait", 61200, 79200],
        ["letter-landscape", 79200, 61200],
        ["a4-portrait", 59528, 84189],
        ["a4-landscape", 84189, 59528],
        [new PageProfile({ id: "custom-print", width: 60000, height: 70000 }), 60000, 70000]
    ];
    for (const [profile, width, height] of profiles) {
        const result = engine.publish({ source, format: "html", pageProfile: profile });
        const html = result.document.assets[0].content;
        assert.match(html, new RegExp(`@page\\{size:${width / 100}(?:\\.\\d+)?pt ${height / 100}(?:\\.\\d+)?pt;margin:0\\}`));
        assert.match(html, new RegExp(`width:${width / 100}(?:\\.\\d+)?pt;height:${height / 100}(?:\\.\\d+)?pt`));
        assert.equal((html.match(/class="publication-page"/g) ?? []).length, result.plan.pageCount);
        assert.match(html, /publication-page:last-child\{break-after:auto\}/);
        assert.doesNotMatch(html, /width:100%[^}]*publication-page/);
    }
    await kernel.dispose();
});

test("standalone SVG pages use exact physical points while preserving canonical viewBox units", async () => {
    assert.equal(formatPublishingPoints(61200), "612");
    assert.equal(formatPublishingPoints(59528), "595.28");
    assert.equal(formatPublishingPoints(84189), "841.89");
    assert.throws(() => formatPublishingPoints(1.5), /safe integers/);
    assert.throws(() => formatPublishingPoints(-1), /safe integers/);
    const { kernel, source, engine } = await fixture();
    const profiles = [
        ["letter-portrait", "612", "792", 61200, 79200],
        ["letter-landscape", "792", "612", 79200, 61200],
        ["a4-portrait", "595.28", "841.89", 59528, 84189],
        ["a4-landscape", "841.89", "595.28", 84189, 59528],
        [new PageProfile({ id: "fractional", width: 60001, height: 70003 }), "600.01", "700.03", 60001, 70003]
    ];
    for (const [profile, width, height, unitsWidth, unitsHeight] of profiles) {
        const svgResult = engine.publish({ source, format: "svg", pageProfile: profile });
        const htmlResult = engine.publish({ source, format: "html", pageProfile: profile });
        const pdfResult = engine.publish({ source, format: "pdf", pageProfile: profile });
        const content = svgResult.document.assets[0].content;
        assert.match(content, new RegExp(`width="${width.replace(".", "\\.")}pt" height="${height.replace(".", "\\.")}pt" viewBox="0 0 ${unitsWidth} ${unitsHeight}"`));
        assert.doesNotMatch(content, new RegExp(`<svg[^>]+width="${unitsWidth}"`));
        assert.match(htmlResult.document.assets[0].content, new RegExp(`@page\\{size:${width.replace(".", "\\.")}pt ${height.replace(".", "\\.")}pt`));
        const pdfText = new TextDecoder("latin1").decode(pdfResult.document.assets[0].content);
        assert.match(pdfText, new RegExp(`/MediaBox \\[0 0 ${width.replace(".", "\\.")} ${height.replace(".", "\\.")}\\]`));
        assert.equal(svgResult.document.assets[0].metadata.physicalWidth, `${width}pt`);
        assert.equal(svgResult.document.assets[0].metadata.physicalHeight, `${height}pt`);
    }
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
    assert.match(converted.operations[1], /0 0 0 RG[\s\S]* S Q$/);
    assert.match(converted.operations[2], /1 1 1 rg[\s\S]* f Q$/);
    assert.match(converted.operations[3], /0 0 0 RG[\s\S]* S Q$/);
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
    assert.match(operations[0], / f Q$/);
    assert.match(operations[1], / S Q$/);
    assert.match(operations[2], / B Q$/);
    assert.match(operations[3], /1 1 1 rg[\s\S]* f Q$/);
    assert.throws(() => trustedSvgPdfOperations(svg(`<rect x="0" y="0" width="10" height="10"/>`)), /does not support/);
    assert.throws(() => trustedSvgPdfOperations("<svg><script/></svg>"), /trusted SVG/);
});

test("PDF affine transforms compose in SVG order and reject unsupported syntax", () => {
    assert.deepEqual(parseSvgTransform("translate(10 20) scale(2,3)"), [2, 0, 0, 3, 10, 20]);
    assert.deepEqual(parseSvgTransform("matrix(1 2 3 4 5 6)"), [1, 2, 3, 4, 5, 6]);
    const rotation = parseSvgTransform("rotate(90)");
    assert.ok(Math.abs(rotation[0]) < 1e-12 && Math.abs(rotation[1] - 1) < 1e-12);
    const centered = parseSvgTransform("rotate(-18 10 12)");
    assert.notDeepEqual(centered, [1, 0, 0, 1, 0, 0]);
    assert.throws(() => parseSvgTransform("skewX(10)"), /unsupported transform/);
    assert.throws(() => parseSvgTransform("rotate(nope)"), /malformed/);
    assert.throws(() => parseSvgTransform("translate(1) garbage"), /malformed transform list/);
});

test("PDF applies nested group and element transforms without sibling leakage", () => {
    const converted = trustedSvgPdfOperations(svg(`
      <g transform="translate(10 20)" fill="currentColor">
        <path d="M0 0h4v4z" transform="scale(2)"/>
      </g>
      <path d="M0 0h4v4z" fill="black"/>
    `));
    assert.match(converted.operations[0], /^q 2 0 0 -2 10 772 cm/);
    assert.match(converted.operations[1], /^q 1 0 0 -1 0 792 cm/);
    assert.match(converted.operations[0], /0 0 0 rg/);
});

test("PDF preserves rotated filled and open notehead ellipse geometry as vector transforms", () => {
    const converted = trustedSvgPdfOperations(svg(`
      <ellipse class="notehead" cx="20" cy="30" rx="7" ry="5" transform="rotate(-18 20 30)" fill="currentColor" stroke="currentColor"/>
      <ellipse class="notehead open" cx="50" cy="30" rx="7" ry="5" transform="translate(2) rotate(-18 50 30)" fill="white" stroke="currentColor"/>
    `));
    assert.equal(converted.operations.length, 2);
    assert.match(converted.operations[0], /^q (?!1 0 0 -1)[^c]+ cm/);
    assert.match(converted.operations[0], /0 0 0 rg[\s\S]* B Q$/);
    assert.match(converted.operations[1], /1 1 1 rg[\s\S]*0 0 0 RG[\s\S]* B Q$/);
    assert.equal(converted.operations[0], trustedSvgPdfOperations(svg(`<ellipse cx="20" cy="30" rx="7" ry="5" transform="rotate(-18 20 30)" fill="currentColor" stroke="currentColor"/>`)).operations[0]);
});

test("PDF applies scale, matrix, rotation, and translation to lines and paths", () => {
    const converted = trustedSvgPdfOperations(svg(`
      <line x1="0" y1="0" x2="10" y2="0" transform="rotate(30) scale(2 3)" stroke="black"/>
      <path d="M0 0h8v8z" transform="matrix(1 0.2 0.1 1 4 5) translate(2 3)" fill="black"/>
    `));
    assert.equal(converted.operations.length, 2);
    assert.match(converted.operations[0], /^q (?!1 0 0 -1)[^c]+ cm/);
    assert.match(converted.operations[1], /^q (?!1 0 0 -1)[^c]+ cm/);
});

test("PDF geometry attributes use strict required finite numeric validation", () => {
    const invalid = [
        [`<line x1="bad" y1="0" x2="1" y2="1" stroke="black"/>`, /line.*x1.*bad/i],
        [`<line x1="0" y1="0" y2="1" stroke="black"/>`, /line.*missing.*x2/i],
        [`<ellipse cx="bad" cy="1" rx="2" ry="3"/>`, /ellipse.*cx.*bad/i],
        [`<ellipse cx="1" cy="1" rx="-1" ry="3"/>`, /ellipse.*rx.*safe geometry range/i],
        [`<circle cx="1" cy="1"/>`, /circle.*missing.*r/i],
        [`<path d="M0 0L1 1" stroke="black" stroke-width="NaN"/>`, /stroke-width.*NaN/i],
        [`<path d="M0 0L1 1" opacity="2"/>`, /opacity.*safe geometry range/i],
        [`<line x1="Infinity" y1="0" x2="1" y2="1"/>`, /x1.*Infinity/i],
        [`<line x1="-Infinity" y1="0" x2="1" y2="1"/>`, /x1.*Infinity/i],
        [`<line x1="10bad" y1="0" x2="1" y2="1"/>`, /x1.*10bad/i],
        [`<line x1="10000001" y1="0" x2="1" y2="1"/>`, /x1.*safe geometry range/i],
        [`<g transform="translate(bad)"><path d="M0 0L1 1"/></g>`, /translate.*bad/i],
        [`<g transform="scale(10000000)"><path d="M0 0L2 1"/></g>`, /transformed point.*safe geometry range/i],
        [`<rect x="0" y="0" width="-1" height="1"/>`, /does not support.*rect/i],
        [`<polyline points="0,0 1"/>`, /does not support.*polyline/i]
    ];
    invalid.forEach(([body, pattern], index) => assert.throws(() => trustedSvgPdfOperations(svg(body), { context: `page 2, block "bad-${index}"` }), pattern));
});

test("PDF path parsing rejects incomplete, unknown, non-finite, and unsupported commands", () => {
    const invalid = [
        ["M 1", /command "M".*truncated/i], ["M", /command "M".*truncated/i],
        ["M0 0 L1", /command "L".*truncated/i], ["M0 0 C1 2 3", /command "C".*truncated/i],
        ["M0 0 Q1 2 3 4", /unsupported command "Q"/i], ["M0 0 A1 1 0 2 0 3 3", /unsupported command "A"/i],
        ["M0 0 X1 2", /unsupported command "X"/i], ["M0 0 1", /command "L".*truncated/i],
        ["M0 0 garbage", /unsupported command "g"/i], ["M0 0 LNaN 1", /command "L".*truncated/i],
        ["M0 0 L10000001 1", /safe geometry range/i], ["M0 0 L1e 2", /command "L".*truncated/i],
        ["M0 0 L1 2 3", /command "L".*truncated/i], ["L0 0", /must begin with an M/i],
        ["M0 0 Z 1", /numeric operand without an active command/i], ["M0 0,", /trailing separator/i]
    ];
    for (const [data, pattern] of invalid) assert.throws(() => trustedSvgPdfOperations(svg(`<path d="${data}" fill="black"/>`), { context: "page 3, block path-fixture" }), pattern);
    const accepted = [
        "M0 0L10 10Z", "M0 0 10 10 20 20", "m1 1l2 3h4v5z",
        "M0 0C1 2 3 4 5 6c1 1 2 2 3 3"
    ];
    for (const data of accepted) {
        const result = trustedSvgPdfOperations(svg(`<path d="${data}" fill="black"/>`));
        assert.equal(result.operations.length, 1);
        assert.doesNotMatch(result.operations[0], /NaN|Infinity|undefined/);
    }
});

test("PDF publication validates every notation block atomically before returning an asset", async () => {
    const { kernel, source, engine } = await fixture(), valid = engine.publish({ source, format: "pdf" }), page = valid.plan.pages.find(value => value.blocks.some(block => block.type === "notation"));
    const malformedBlocks = page.blocks.map(block => block.type !== "notation" ? block : new PublicationBlock({ id: block.id, type: block.type, x: block.x, y: block.y, width: block.width, height: block.height, svg: svg(`<line x1="bad" y1="0" x2="1" y2="1" stroke="black"/>`), source: JSON.parse(JSON.stringify(block.source)), metadata: block.metadata.toJSON() }));
    const malformedPage = new PublicationPage({ id: page.id, number: page.number, profile: page.profile, blocks: malformedBlocks, metadata: page.metadata.toJSON() });
    const malformedPlan = new PublicationPlan({ id: valid.plan.id, request: valid.request, pages: valid.plan.pages.map(value => value === page ? malformedPage : value), metadata: valid.plan.metadata.toJSON() });
    let document;
    assert.throws(() => { document = new PdfPublishingStrategy().publish(malformedPlan); }, /page 1.*block.*row.*line.*x1.*bad/i);
    assert.equal(document, undefined);
    assert.equal(valid.document.assets.length, 1);
    assert.equal(valid.plan.request.source, source);
    await kernel.dispose();
});

test("all generated PDF content streams contain only finite defined drawing operands", async () => {
    const { kernel, source, engine } = await fixture();
    for (const profile of ["letter-portrait", "letter-landscape", "a4-portrait", "a4-landscape"]) {
        const result = engine.publish({ source, format: "pdf", pageProfile: profile });
        const text = new TextDecoder("latin1").decode(result.document.assets[0].content);
        const streams = [...text.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => match[1].replace(/\((?:\\.|[^)])*\)/g, "()"));
        assert.equal(streams.length, result.plan.pageCount);
        for (const stream of streams) assert.doesNotMatch(stream, /(?:^|[\s\[])\+?(?:NaN|Infinity|undefined|null)(?=$|[\s\]])/im);
        assert.match(text, new RegExp(`/Count ${result.plan.pageCount}`));
    }
    await kernel.dispose();
});
