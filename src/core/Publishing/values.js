import { canonicalSerialize, cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ExerciseSetResult, boundedExerciseSetId } from "../ExerciseSet/index.js";

const integer = (value, name, { min = 0, max = 200000 } = {}) => {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new ValidationError(`${name} must be a safe integer from ${min} through ${max}.`);
    return value;
};
const text = (value, name, max = 4000) => {
    if (value === null || value === undefined || value === "") return "";
    value = String(value).trim();
    if (!value || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) throw new ValidationError(`${name} is malformed.`);
    return value;
};
const metadata = value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Publishing metadata must be an object.");
    canonicalSerialize(value);
    return freezeDeep(cloneDeep(value));
};

export const PUBLISHING_UNITS_PER_POINT = 100;
export const PUBLISHING_FORMATS = Object.freeze(["html", "svg", "pdf"]);
export const PUBLISHING_MEDIA_TYPES = Object.freeze({ html: "text/html", svg: "image/svg+xml", pdf: "application/pdf" });
export const PUBLISHING_LIMITS = Object.freeze({ pages: 256, blocksPerPage: 512, assets: 256, filenameLength: 120, metadataLength: 4000 });

export class PageMargins {
    constructor({ top = 5400, right = 5400, bottom = 5400, left = 5400 } = {}) {
        Object.assign(this, { top: integer(top, "Top margin"), right: integer(right, "Right margin"), bottom: integer(bottom, "Bottom margin"), left: integer(left, "Left margin") });
        Object.freeze(this);
    }
}

export class PageProfile {
    constructor({ id = "custom", name = "Custom", width, height, orientation = "portrait", margins = {}, headerHeight = 1800, footerHeight = 1800, minimumContentWidth = 18000, minimumContentHeight = 18000 } = {}) {
        width = integer(width, "Page width", { min: 20000, max: 200000 });
        height = integer(height, "Page height", { min: 20000, max: 200000 });
        if (!["portrait", "landscape"].includes(orientation) || (orientation === "portrait" ? width > height : width < height)) throw new ValidationError("Page orientation does not match its dimensions.");
        margins = margins instanceof PageMargins ? margins : new PageMargins(margins);
        headerHeight = integer(headerHeight, "Header height", { max: 20000 });
        footerHeight = integer(footerHeight, "Footer height", { max: 20000 });
        minimumContentWidth=integer(minimumContentWidth,"Minimum content width",{min:1,max:200000});minimumContentHeight=integer(minimumContentHeight,"Minimum content height",{min:1,max:200000});
        const contentWidth = width - margins.left - margins.right;
        const contentHeight = height - margins.top - margins.bottom - headerHeight - footerHeight;
        if (contentWidth < minimumContentWidth || contentHeight < minimumContentHeight) throw new ValidationError("Page margins and reserved areas eliminate the minimum printable content bounds.");
        Object.assign(this, { id: text(id, "Page profile id", 80), name: text(name, "Page profile name", 160), width, height, orientation, margins, headerHeight, footerHeight, minimumContentWidth, minimumContentHeight, contentBounds: Object.freeze({ x: margins.left, y: margins.top + headerHeight, width: contentWidth, height: contentHeight }) });
        Object.freeze(this);
    }
}

const profile = (id, name, width, height, orientation) => new PageProfile({ id, name, width, height, orientation });
export const PAGE_PROFILES = Object.freeze({
    "letter-portrait": profile("letter-portrait", "US Letter portrait", 61200, 79200, "portrait"),
    "letter-landscape": profile("letter-landscape", "US Letter landscape", 79200, 61200, "landscape"),
    "a4-portrait": profile("a4-portrait", "A4 portrait", 59528, 84189, "portrait"),
    "a4-landscape": profile("a4-landscape", "A4 landscape", 84189, 59528, "landscape")
});

export class PublishingMetadata {
    constructor(value = {}) { Object.assign(this, metadata(value)); Object.freeze(this); }
    toJSON() { return Object.fromEntries(Object.entries(this)); }
}

export class PublishingRequest {
    constructor({ source, title, subtitle = "", instructions, author = "", organization = "", edition = "", copyright = "", creationLabel = "", pageProfile = "letter-portrait", format = "html", filenameBase = "", headerPolicy = "document-title", footerText = "", pageNumberPolicy = "all", sectionBreakPolicy = "flow", exerciseBreakPolicy = "keep-heading", pluginId = null, strategyId = null, metadata: extra = {} } = {}) {
        if (!(source instanceof ExerciseSetResult)) throw new ValidationError("Publishing requires an authoritative completed ExerciseSetResult.");
        pageProfile = pageProfile instanceof PageProfile ? pageProfile : PAGE_PROFILES[String(pageProfile)];
        if (!(pageProfile instanceof PageProfile)) throw new ValidationError(`Unsupported page profile "${String(pageProfile)}".`);
        format = String(format).trim().toLowerCase();
        if (!PUBLISHING_FORMATS.includes(format)) throw new ValidationError(`Unsupported publishing format "${format}".`);
        if (!["none", "document-title", "section-title"].includes(headerPolicy) || !["none", "all", "except-first"].includes(pageNumberPolicy) || !["flow", "new-page"].includes(sectionBreakPolicy) || !["keep-heading", "new-page"].includes(exerciseBreakPolicy)) throw new ValidationError("Invalid publication layout policy.");
        const normalizedTitle = text(title ?? source.document.title, "Publication title", 160);
        const safeFilename = text(filenameBase || normalizedTitle, "Filename base", PUBLISHING_LIMITS.filenameLength).normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, PUBLISHING_LIMITS.filenameLength);
        if (!safeFilename || safeFilename === "." || safeFilename === "..") throw new ValidationError("Publication filename base is unsafe.");
        if (instructions === null) throw new ValidationError("Publication instructions must be a string or undefined.");
        const normalizedInstructions = text(instructions === undefined ? source.document.instructions : instructions, "Publication instructions");
        const identity = boundedExerciseSetId({ kind: "publication-request", readable: normalizedTitle, identity: { source: source.request.identity, title: normalizedTitle, subtitle, instructions: normalizedInstructions, author, organization, edition, copyright, creationLabel, pageProfile: pageProfile.id, format, safeFilename, headerPolicy, footerText, pageNumberPolicy, sectionBreakPolicy, exerciseBreakPolicy, pluginId, strategyId, metadata: extra } });
        Object.assign(this, { source, title: normalizedTitle, subtitle: text(subtitle, "Publication subtitle", 500), instructions: normalizedInstructions, author: text(author, "Publication author", 160), organization: text(organization, "Publication organization", 160), edition: text(edition, "Publication edition", 160), copyright: text(copyright, "Publication copyright", 500), creationLabel: text(creationLabel, "Publication creation label", 160), pageProfile, format, filenameBase: safeFilename, headerPolicy, footerText: text(footerText, "Publication footer", 500), pageNumberPolicy, sectionBreakPolicy, exerciseBreakPolicy, pluginId: pluginId === null ? null : text(pluginId, "Publishing plugin id", 160), strategyId: strategyId === null ? null : text(strategyId, "Publishing strategy id", 160), metadata: new PublishingMetadata(extra), identity });
        Object.freeze(this);
    }
    static from(value) { return value instanceof this ? value : new this(value); }
}

export class PublicationBlock {
    constructor({ id, type, x, y, width, height, text: value = "", svg = "", source = {}, metadata: extra = {} } = {}) {
        if (!["title", "subtitle", "instructions", "curriculum-heading", "unit-heading", "lesson-heading", "section-heading", "item-heading", "semantic-summary", "notation", "spacer", "header", "footer", "page-number"].includes(type)) throw new ValidationError(`Unsupported publication block type "${String(type)}".`);
        Object.assign(this, { id: text(id, "Publication block id", 160), type, x: integer(x, "Block x"), y: integer(y, "Block y"), width: integer(width, "Block width", { min: 1 }), height: integer(height, "Block height", { min: 1 }), text: text(value, "Publication block text"), svg: String(svg ?? ""), source: metadata(source), metadata: new PublishingMetadata(extra) });
        Object.freeze(this);
    }
}

export class PublicationPage {
    constructor({ id, number, profile, blocks, metadata: extra = {} } = {}) {
        if (!(profile instanceof PageProfile) || !Array.isArray(blocks) || blocks.some(value => !(value instanceof PublicationBlock)) || blocks.length > PUBLISHING_LIMITS.blocksPerPage) throw new ValidationError("Invalid publication page.");
        Object.assign(this, { id: text(id, "Publication page id", 160), number: integer(number, "Page number", { min: 1, max: PUBLISHING_LIMITS.pages }), profile, blocks: Object.freeze([...blocks]), metadata: new PublishingMetadata(extra) });
        Object.freeze(this);
    }
}

export class PublicationPlan {
    constructor({ id, request, pages, metadata: extra = {} } = {}) {
        if (!(request instanceof PublishingRequest) || !Array.isArray(pages) || !pages.length || pages.length > PUBLISHING_LIMITS.pages || pages.some(value => !(value instanceof PublicationPage))) throw new ValidationError("Invalid publication plan.");
        Object.assign(this, { id: text(id, "Publication plan id", 160), request, pages: Object.freeze([...pages]), pageCount: pages.length, blocks: Object.freeze(pages.flatMap(page => page.blocks)), metadata: new PublishingMetadata(extra) });
        Object.freeze(this);
    }
}

export class PublishedAsset {
    constructor({ id, filename, format, mediaType, content, pageNumber = null, metadata: extra = {} } = {}) {
        if (!PUBLISHING_FORMATS.includes(format) || PUBLISHING_MEDIA_TYPES[format] !== mediaType || !(typeof content === "string" || content instanceof Uint8Array)) throw new ValidationError("Invalid published asset.");
        const stored=content instanceof Uint8Array?new Uint8Array(content):content;
        Object.assign(this, { id: text(id, "Published asset id", 160), filename: text(filename, "Published filename", 160), format, mediaType, pageNumber, metadata: new PublishingMetadata(extra) });
        Object.defineProperty(this,"content",{enumerable:true,get:()=>stored instanceof Uint8Array?new Uint8Array(stored):stored});
        Object.freeze(this);
    }
}

export class PublishedDocument {
    constructor({ id, plan, assets, format, mediaType, filename, metadata: extra = {} } = {}) {
        if (!(plan instanceof PublicationPlan) || !Array.isArray(assets) || !assets.length || assets.length > PUBLISHING_LIMITS.assets || assets.some(value => !(value instanceof PublishedAsset))) throw new ValidationError("Invalid published document.");
        Object.assign(this, { id: text(id, "Published document id", 160), plan, assets: Object.freeze([...assets]), format, mediaType, filename: text(filename, "Published filename", 160), metadata: new PublishingMetadata(extra) });
        Object.freeze(this);
    }
}

export class PublishingResult {
    constructor({ request, plan, document, metadata: extra = {} } = {}) {
        if (!(request instanceof PublishingRequest) || !(plan instanceof PublicationPlan) || plan.request !== request || !(document instanceof PublishedDocument) || document.plan !== plan) throw new ValidationError("Invalid publishing result.");
        Object.assign(this, { request, plan, document, metadata: new PublishingMetadata(extra) });
        Object.freeze(this);
    }
}
