import { ValidationError } from "../Foundation/index.js";
import { boundedExerciseSetId } from "../ExerciseSet/index.js";
import { validateTrustedSvgContent } from "../Rendering/index.js";
import { PublicationBlock, PublicationPage, PublicationPlan, PublishingRequest } from "./values.js";

const METRICS = Object.freeze({ title: 3200, subtitle: 1800, instructionsLine: 1500, sectionHeading: 2400, itemHeading: 1900, gap: 900, notationScale: 54, minimumNotationScale: 36 });
const lines = value => Math.max(1, Math.ceil(String(value || "").length / 88));
const id = (request, kind, readable, identity) => boundedExerciseSetId({ kind, readable, identity: { publication: request.identity, ...identity } });

function notationDimensions(row, bounds) {
    const width = Math.max(1, Math.ceil(row.layoutPlan.bounds.width));
    const heightMatch = row.content.match(/\bheight="([0-9.]+)"/i);
    const height = Math.max(1, Math.ceil(Number(heightMatch?.[1] ?? row.layoutPlan.bounds.height)));
    const scale = Math.min(METRICS.notationScale, Math.floor(bounds.width / width));
    if (scale < METRICS.minimumNotationScale) throw new ValidationError(`Notation row "${row.id}" is wider than the printable page at the minimum readable scale.`);
    const scaledHeight = Math.ceil(height * scale);
    if (scaledHeight > bounds.height) throw new ValidationError(`Notation row "${row.id}" is taller than one printable page and cannot be split safely.`);
    return { width: width * scale, height: scaledHeight, scale, sourceWidth: width, sourceHeight: height };
}
function publicationNotation(content){
    const result=content.replace(/<text\b(?=[^>]*\bclass="score-title")[^>]*>[\s\S]*?<\/text>/i,"");
    if(!validateTrustedSvgContent(result))throw new ValidationError("Publication SVG normalization did not preserve the trusted-SVG contract.");
    return result;
}

function sourceBlocks(request) {
    const bounds = request.pageProfile.contentBounds, result = [], document = request.source.document;
    const pushText = (type, value, height, source = {}) => {
        if (value) result.push({ type, text: value, height, keepWithNext: type.endsWith("heading"), source });
    };
    pushText("title", request.title, METRICS.title, { exerciseSetId: document.id });
    pushText("subtitle", request.subtitle, METRICS.subtitle, { exerciseSetId: document.id });
    pushText("instructions", request.instructions, METRICS.instructionsLine * lines(request.instructions), { exerciseSetId: document.id });
    document.sections.forEach((section, sectionIndex) => {
        pushText("section-heading", section.title, METRICS.sectionHeading, { exerciseSetId: document.id, sectionId: section.id, sectionIndex });
        section.items.forEach((item, itemIndex) => {
            const itemSource = { exerciseSetId: document.id, sectionId: section.id, itemId: item.id, itemIndex, provenance: item.metadata.toJSON() };
            pushText("item-heading", item.label || item.presentation.sections[0]?.title || `Exercise ${item.sequence}`, METRICS.itemHeading, itemSource);
            item.presentation.sections.flatMap(sectionValue => sectionValue.rows).forEach((row, rowIndex) => {
                if (!validateTrustedSvgContent(row.content)) throw new ValidationError(`Publication item "${item.id}", row "${row.id}" contains untrusted SVG.`);
                const dimensions = notationDimensions(row, bounds);
                result.push({ type: "notation", svg: publicationNotation(row.content), height: dimensions.height, source: { ...itemSource, rowId: row.id, rowIndex, systemIds: row.systems.map(system => system.id), scoreGraphId: row.graph.score.id }, metadata: dimensions });
            });
        });
    });
    return result;
}

export class PublicationPlanner {
    plan(input) {
        const request = PublishingRequest.from(input), profile = request.pageProfile, bounds = profile.contentBounds;
        const candidates = sourceBlocks(request), pages = [];
        let blocks = [], y = bounds.y, pageNumber = 1, currentSection = "";
        const finish = () => {
            if (!blocks.length) return;
            const pageId = id(request, "publication-page", `page-${pageNumber}`, { pageNumber });
            const decorated = [];
            if (request.headerPolicy !== "none" && (pageNumber > 1 || request.headerPolicy === "section-title")) {
                const value = request.headerPolicy === "section-title" ? (currentSection || request.title) : request.title;
                decorated.push(new PublicationBlock({ id: id(request, "publication-block", `header-${pageNumber}`, { pageNumber, type: "header" }), type: "header", x: profile.margins.left, y: profile.margins.top, width: bounds.width, height: profile.headerHeight, text: value, source: { exerciseSetId: request.source.document.id } }));
            }
            decorated.push(...blocks);
            const showNumber = request.pageNumberPolicy === "all" || (request.pageNumberPolicy === "except-first" && pageNumber > 1);
            if (request.footerText || showNumber) decorated.push(new PublicationBlock({ id: id(request, "publication-block", `footer-${pageNumber}`, { pageNumber, type: "footer" }), type: showNumber ? "page-number" : "footer", x: profile.margins.left, y: profile.height - profile.margins.bottom - profile.footerHeight, width: bounds.width, height: profile.footerHeight, text: [request.footerText, showNumber ? `Page ${pageNumber}` : ""].filter(Boolean).join(" · "), source: { exerciseSetId: request.source.document.id } }));
            pages.push(new PublicationPage({ id: pageId, number: pageNumber, profile, blocks: decorated, metadata: { sourceExerciseSetId: request.source.document.id } }));
            blocks = []; y = bounds.y; pageNumber += 1;
        };
        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index], next = candidates[index + 1];
            if (candidate.type === "section-heading") currentSection = candidate.text;
            const required = candidate.height + METRICS.gap + (candidate.keepWithNext && next ? next.height : 0);
            const forced = (candidate.type === "section-heading" && request.sectionBreakPolicy === "new-page" && blocks.length)
                || (candidate.type === "item-heading" && request.exerciseBreakPolicy === "new-page" && blocks.length);
            if (forced || y + required > bounds.y + bounds.height) finish();
            if (y + candidate.height > bounds.y + bounds.height) throw new ValidationError(`Publication block for row "${candidate.source.rowId ?? "heading"}" exceeds printable page bounds.`);
            const identitySource=JSON.parse(JSON.stringify(candidate.source));
            const blockId = id(request, "publication-block", `${candidate.type}-${pages.length + 1}-${index + 1}`, { index, type: candidate.type, source: identitySource });
            blocks.push(new PublicationBlock({ id: blockId, type: candidate.type, x: bounds.x, y, width: bounds.width, height: candidate.height, text: candidate.text, svg: candidate.svg, source: identitySource, metadata: candidate.metadata }));
            y += candidate.height + METRICS.gap;
        }
        finish();
        if (!pages.length) throw new ValidationError("Publication source contains no publishable authoritative content.");
        const planId = id(request, "publication-plan", request.title, { pageCount: pages.length });
        return new PublicationPlan({ id: planId, request, pages, metadata: { units: "hundredths-of-a-point", unitsPerPoint: 100, sourceExerciseSetId: request.source.document.id, pagination: "greedy-keep-heading-with-first-notation", oversizedPolicy: "scale-to-36-percent-point-or-reject" } });
    }
}

export default PublicationPlanner;
