import { ValidationError } from "../Foundation/index.js";
import { boundedExerciseSetId } from "../ExerciseSet/index.js";
import { validateTrustedSvgContent } from "../Rendering/index.js";
import { layoutPublicationText } from "./textLayout.js";
import { PublicationBlock, PublicationPage, PublicationPlan, PublishingRequest } from "./values.js";

const METRICS = Object.freeze({ gap: 900, notationScale: 54, minimumNotationScale: 36 });
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
    const pushText = (type, value, source = {}, { keepWithNext = type.endsWith("heading") } = {}) => {
        if (value) {
            const textLayout = layoutPublicationText({ text: value, availableWidth: bounds.width, category: type });
            result.push({ type, text: value, height: textLayout.height, keepWithNext, source, metadata: { textLayout, pagination: { indivisible: true, keepWithNext } } });
        }
    };
    pushText("title", request.title, { exerciseSetId: document.id });
    pushText("subtitle", request.subtitle, { exerciseSetId: document.id });
    pushText("instructions", request.instructions, { exerciseSetId: document.id });
    let priorUnitIdentity = null;
    document.sections.forEach((section, sectionIndex) => {
        const sectionMetadata = section.metadata.toJSON(), unitIdentity = sectionMetadata.curriculumId && sectionMetadata.unitId ? `${sectionMetadata.curriculumPluginId ?? ""}:${sectionMetadata.curriculumId}:${sectionMetadata.unitId}` : null;
        if (unitIdentity && unitIdentity !== priorUnitIdentity) pushText("unit-heading", section.label || sectionMetadata.unitId, { exerciseSetId: document.id, sectionId: section.id, sectionIndex, curriculumId: sectionMetadata.curriculumId, unitId: sectionMetadata.unitId });
        priorUnitIdentity = unitIdentity;
        pushText("section-heading", section.title, { exerciseSetId: document.id, sectionId: section.id, sectionIndex });
        section.items.forEach((item, itemIndex) => {
            const itemSource = { exerciseSetId: document.id, sectionId: section.id, itemId: item.id, itemIndex, provenance: item.metadata.toJSON() };
            pushText("item-heading", item.label || item.presentation.sections[0]?.title || `Exercise ${item.sequence}`, itemSource);
            pushText("semantic-summary", item.metadata.toJSON().semanticSummary, itemSource, { keepWithNext: true });
            item.presentation.sections.flatMap(sectionValue => sectionValue.rows).forEach((row, rowIndex) => {
                if (!validateTrustedSvgContent(row.content)) throw new ValidationError(`Publication item "${item.id}", row "${row.id}" contains untrusted SVG.`);
                const dimensions = notationDimensions(row, bounds);
                result.push({ type: "notation", svg: publicationNotation(row.content), height: dimensions.height, keepWithNext: false, source: { ...itemSource, rowId: row.id, rowIndex, systemIds: row.systems.map(system => system.id), scoreGraphId: row.graph.score.id }, metadata: { ...dimensions, pagination: { indivisible: true, keepWithNext: false, endsKeepGroup: true } } });
            });
        });
    });
    return result;
}

function minimumKeepGroup(candidates, start) {
    let end = start;
    while (candidates[end]?.keepWithNext && end + 1 < candidates.length) end += 1;
    const members = candidates.slice(start, end + 1);
    const height = members.reduce((total, candidate) => total + candidate.height, 0) + METRICS.gap * Math.max(0, members.length - 1);
    return Object.freeze({ start, end, height, members: Object.freeze(members) });
}

function keepGroupContext(group) {
    const source = group.members.at(-1)?.source ?? group.members[0]?.source ?? {};
    const provenance = source.provenance ?? {};
    return [
        ["curriculum", provenance.curriculumId], ["unit", provenance.unitId], ["lesson", provenance.lessonId],
        ["section", source.sectionId], ["item", source.itemId], ["row", source.rowId],
        ["systems", source.systemIds?.join(",")]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "").map(([name, value]) => `${name} "${value}"`).join(", ");
}
function sectionContext(candidate) {
    return Object.freeze({ text: candidate.text, source: Object.freeze(JSON.parse(JSON.stringify(candidate.source))) });
}

export class PublicationPlanner {
    plan(input) {
        const request = PublishingRequest.from(input), profile = request.pageProfile, bounds = profile.contentBounds;
        const candidates = sourceBlocks(request), pages = [];
        const documentContext = Object.freeze({ text: request.title, source: Object.freeze({ exerciseSetId: request.source.document.id }) });
        let blocks = [], y = bounds.y, pageNumber = 1, activeSection = null, pageContext = null;
        const keepGroups = [];
        const finish = () => {
            if (!blocks.length) return;
            const pageId = id(request, "publication-page", `page-${pageNumber}`, { pageNumber });
            const decorated = [];
            if (request.headerPolicy !== "none" && (pageNumber > 1 || request.headerPolicy === "section-title")) {
                const context = request.headerPolicy === "section-title" ? (pageContext ?? documentContext) : documentContext;
                const textLayout = layoutPublicationText({ text: context.text, availableWidth: bounds.width, category: "header" });
                if (textLayout.height > profile.headerHeight) throw new ValidationError(`Page ${pageNumber} header text exceeds the reserved header area.`);
                decorated.push(new PublicationBlock({ id: id(request, "publication-block", `header-${pageNumber}`, { pageNumber, type: "header", context: context.source }), type: "header", x: profile.margins.left, y: profile.margins.top, width: bounds.width, height: textLayout.height, text: context.text, source: context.source, metadata: { textLayout, pageHeaderContext: context } }));
            }
            decorated.push(...blocks);
            const showNumber = request.pageNumberPolicy === "all" || (request.pageNumberPolicy === "except-first" && pageNumber > 1);
            if (request.footerText || showNumber) {
                const footerText = [request.footerText, showNumber ? `Page ${pageNumber}` : ""].filter(Boolean).join(" · ");
                const footerType = showNumber ? "page-number" : "footer";
                const textLayout = layoutPublicationText({ text: footerText, availableWidth: bounds.width, category: footerType });
                if (textLayout.height > profile.footerHeight) throw new ValidationError(`Page ${pageNumber} footer text exceeds the reserved footer area.`);
                decorated.push(new PublicationBlock({ id: id(request, "publication-block", `footer-${pageNumber}`, { pageNumber, type: "footer" }), type: footerType, x: profile.margins.left, y: profile.height - profile.margins.bottom - profile.footerHeight, width: bounds.width, height: textLayout.height, text: footerText, source: pageContext?.source ?? documentContext.source, metadata: { textLayout } }));
            }
            const capturedContext = pageContext ?? documentContext;
            pages.push(new PublicationPage({ id: pageId, number: pageNumber, profile, blocks: decorated, metadata: { sourceExerciseSetId: request.source.document.id, headerContext: capturedContext } }));
            blocks = []; y = bounds.y; pageContext = null; pageNumber += 1;
        };
        for (let index = 0; index < candidates.length;) {
            const group = minimumKeepGroup(candidates, index), first = group.members[0];
            if (group.height > bounds.height) throw new ValidationError(`Minimum publication keep group exceeds one printable page${keepGroupContext(group) ? ` for ${keepGroupContext(group)}` : ""}; its headings and first notation system cannot be split or scaled below the readability minimum.`);
            const forced = (group.members.some(candidate => candidate.type === "section-heading") && request.sectionBreakPolicy === "new-page" && blocks.length)
                || (first.type === "item-heading" && request.exerciseBreakPolicy === "new-page" && blocks.length);
            if (forced || y + group.height > bounds.y + bounds.height) finish();
            const enteringSection = group.members.find(candidate => candidate.type === "section-heading");
            if (!blocks.length && enteringSection) activeSection = sectionContext(enteringSection);
            const groupPage = pageNumber;
            for (let memberIndex = 0; memberIndex < group.members.length; memberIndex += 1) {
                const candidate = group.members[memberIndex], candidateIndex = index + memberIndex;
                if (candidate.type === "section-heading") activeSection = sectionContext(candidate);
                if (!pageContext) pageContext = activeSection ?? documentContext;
                if (y + candidate.height > bounds.y + bounds.height) throw new ValidationError(`Publication block for row "${candidate.source.rowId ?? "heading"}" exceeds printable page bounds.`);
                const identitySource=JSON.parse(JSON.stringify(candidate.source));
                const blockId = id(request, "publication-block", `${candidate.type}-${pages.length + 1}-${candidateIndex + 1}`, { index: candidateIndex, type: candidate.type, source: identitySource });
                blocks.push(new PublicationBlock({ id: blockId, type: candidate.type, x: bounds.x, y, width: bounds.width, height: candidate.height, text: candidate.text, svg: candidate.svg, source: identitySource, metadata: candidate.metadata }));
                y += candidate.height + METRICS.gap;
            }
            if (group.members.length > 1) keepGroups.push(Object.freeze({ id: id(request, "publication-keep-group", `group-${group.start + 1}`, { start: group.start, end: group.end }), startIndex: group.start, endIndex: group.end, pageNumber: groupPage, height: group.height, blockTypes: Object.freeze(group.members.map(candidate => candidate.type)) }));
            index = group.end + 1;
        }
        finish();
        if (!pages.length) throw new ValidationError("Publication source contains no publishable authoritative content.");
        const planId = id(request, "publication-plan", request.title, { pageCount: pages.length });
        return new PublicationPlan({ id: planId, request, pages, metadata: { units: "hundredths-of-a-point", unitsPerPoint: 100, sourceExerciseSetId: request.source.document.id, pagination: "greedy-atomic-transitive-keep-groups", keepGroups: Object.freeze(keepGroups), pageHeaderPolicy: "section-active-at-page-start", textLayout: "deterministic-glyph-metrics", oversizedPolicy: "print-profile-scale-to-36-percent-point-or-contextual-reject" } });
    }
}

export default PublicationPlanner;
