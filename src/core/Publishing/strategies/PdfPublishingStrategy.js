import { boundedExerciseSetId } from "../../ExerciseSet/index.js";
import { ValidationError } from "../../Foundation/index.js";
import { validateTrustedSvgContent } from "../../Rendering/index.js";
import { PublishedAsset, PublishedDocument } from "../values.js";
import { PublishingStrategy } from "../PublishingStrategy.js";

const enc = new TextEncoder();
const number = value => Number(value).toFixed(3).replace(/\.?0+$/, "");
const pdfText = value => String(value)
    .replaceAll("𝄫", "bb").replaceAll("𝄪", "##")
    .replaceAll("♭", "b").replaceAll("♯", "#").replaceAll("♮", " natural ")
    .replaceAll("·", "-")
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1];
const numericAttribute = (tag, name, fallback = 0) => Number(attribute(tag, name) ?? fallback);
const DEFAULT_PRESENTATION = Object.freeze({
    fill: "black", stroke: "none", color: "black", fillOpacity: 1,
    strokeOpacity: 1, opacity: 1, fillRule: "nonzero", strokeWidth: 1,
    strokeLinecap: "butt", strokeLinejoin: "miter",
    translateX: 0, translateY: 0
});

function opacity(value, name) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new ValidationError(`Published notation has an invalid ${name} value.`);
    return parsed;
}
function paint(value, color, name) {
    const resolved = value === "currentColor" ? color : value;
    if (resolved === "none") return null;
    const normalized = String(resolved).toLowerCase();
    if (normalized === "black" || normalized === "#000" || normalized === "#000000") return [0, 0, 0];
    if (normalized === "white" || normalized === "#fff" || normalized === "#ffffff") return [1, 1, 1];
    throw new ValidationError(`Published notation uses unsupported ${name} paint "${resolved}".`);
}
function presentation(parent, tag) {
    const color = attribute(tag, "color") ?? parent.color;
    const fillRule = attribute(tag, "fill-rule") ?? parent.fillRule;
    if (!["nonzero", "evenodd"].includes(fillRule)) throw new ValidationError(`Published notation uses unsupported fill-rule "${fillRule}".`);
    const transform = attribute(tag, "transform");
    let translateX = parent.translateX, translateY = parent.translateY;
    if (transform) {
        const match = transform.match(/^translate\(\s*([-+.\d]+)(?:[\s,]+([-+.\d]+))?\s*\)$/i);
        if (match) {
            translateX += Number(match[1]);
            translateY += Number(match[2] ?? 0);
        } else if (!/^rotate\(\s*-?18(?:[\s,]+[-+.\d]+){2}\s*\)$/i.test(transform)) {
            throw new ValidationError(`Published notation uses unsupported transform "${transform}".`);
        }
    }
    return Object.freeze({
        fill: attribute(tag, "fill") ?? parent.fill,
        stroke: attribute(tag, "stroke") ?? parent.stroke,
        color,
        fillOpacity: attribute(tag, "fill-opacity") === undefined ? parent.fillOpacity : opacity(attribute(tag, "fill-opacity"), "fill-opacity"),
        strokeOpacity: attribute(tag, "stroke-opacity") === undefined ? parent.strokeOpacity : opacity(attribute(tag, "stroke-opacity"), "stroke-opacity"),
        opacity: parent.opacity * (attribute(tag, "opacity") === undefined ? 1 : opacity(attribute(tag, "opacity"), "opacity")),
        fillRule,
        strokeWidth: attribute(tag, "stroke-width") === undefined ? parent.strokeWidth : numericAttribute(tag, "stroke-width"),
        strokeLinecap: attribute(tag, "stroke-linecap") ?? parent.strokeLinecap,
        strokeLinejoin: attribute(tag, "stroke-linejoin") ?? parent.strokeLinejoin,
        translateX, translateY
    });
}
function lineStyle(state) {
    const caps = { butt: 0, round: 1, square: 2 }, joins = { miter: 0, round: 1, bevel: 2 };
    if (!(state.strokeLinecap in caps)) throw new ValidationError(`Published notation uses unsupported stroke-linecap "${state.strokeLinecap}".`);
    if (!(state.strokeLinejoin in joins)) throw new ValidationError(`Published notation uses unsupported stroke-linejoin "${state.strokeLinejoin}".`);
    return `${caps[state.strokeLinecap]} J ${joins[state.strokeLinejoin]} j`;
}
function pathGeometry(tag, mapX, mapY) {
    const data = attribute(tag, "d");
    if (!data) return "";
    const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
    let index = 0, command = "", cx = 0, cy = 0, sx = 0, sy = 0;
    const out = [], numeric = () => Number(tokens[index++]), point = (x, y) => `${number(mapX(x))} ${number(mapY(y))}`;
    while (index < tokens.length) {
        if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++];
        if (!command) break;
        const relative = command === command.toLowerCase(), upper = command.toUpperCase();
        if (upper === "M" || upper === "L") {
            const px = numeric(), py = numeric(); cx = relative ? cx + px : px; cy = relative ? cy + py : py;
            if (upper === "M") { sx = cx; sy = cy; }
            out.push(`${point(cx, cy)} ${upper === "M" ? "m" : "l"}`);
            if (upper === "M") command = relative ? "l" : "L";
        } else if (upper === "H") { const value = numeric(); cx = relative ? cx + value : value; out.push(`${point(cx, cy)} l`); }
        else if (upper === "V") { const value = numeric(); cy = relative ? cy + value : value; out.push(`${point(cx, cy)} l`); }
        else if (upper === "C") {
            const values = Array.from({ length: 6 }, numeric);
            const x1 = relative ? cx + values[0] : values[0], y1 = relative ? cy + values[1] : values[1];
            const x2 = relative ? cx + values[2] : values[2], y2 = relative ? cy + values[3] : values[3];
            const x3 = relative ? cx + values[4] : values[4], y3 = relative ? cy + values[5] : values[5];
            out.push(`${point(x1, y1)} ${point(x2, y2)} ${point(x3, y3)} c`); cx = x3; cy = y3;
        } else if (upper === "Z") { out.push("h"); cx = sx; cy = sy; command = ""; }
        else throw new ValidationError(`Published notation path uses unsupported command "${command}".`);
    }
    return out.join(" ");
}
function ellipseGeometry(tag, mapX, mapY, scale, circle) {
    const cx = mapX(numericAttribute(tag, "cx")), cy = mapY(numericAttribute(tag, "cy"));
    const rx = numericAttribute(tag, circle ? "r" : "rx") * scale, ry = numericAttribute(tag, circle ? "r" : "ry") * scale, k = .5522847498;
    return `${number(cx + rx)} ${number(cy)} m ${number(cx + rx)} ${number(cy + k * ry)} ${number(cx + k * rx)} ${number(cy + ry)} ${number(cx)} ${number(cy + ry)} c ${number(cx - k * rx)} ${number(cy + ry)} ${number(cx - rx)} ${number(cy + k * ry)} ${number(cx - rx)} ${number(cy)} c ${number(cx - rx)} ${number(cy - k * ry)} ${number(cx - k * rx)} ${number(cy - ry)} ${number(cx)} ${number(cy - ry)} c ${number(cx + k * rx)} ${number(cy - ry)} ${number(cx + rx)} ${number(cy - k * ry)} ${number(cx + rx)} ${number(cy)} c`;
}
function paintedGeometry(geometry, state, scale, graphicsStates) {
    const fill = paint(state.fill, state.color, "fill"), stroke = paint(state.stroke, state.color, "stroke");
    if (!fill && !stroke) return "";
    const fillAlpha = state.opacity * state.fillOpacity, strokeAlpha = state.opacity * state.strokeOpacity;
    const alphaKey = `${number(fillAlpha)}:${number(strokeAlpha)}`;
    if (!graphicsStates.has(alphaKey)) graphicsStates.set(alphaKey, `GS${graphicsStates.size + 1}`);
    const output = [`/${graphicsStates.get(alphaKey)} gs`];
    if (fill) output.push(`${fill.map(number).join(" ")} rg`);
    if (stroke) output.push(`${stroke.map(number).join(" ")} RG`, `${number(Math.max(.35, state.strokeWidth * scale))} w`, lineStyle(state));
    output.push(geometry, fill && stroke ? (state.fillRule === "evenodd" ? "B*" : "B") : fill ? (state.fillRule === "evenodd" ? "f*" : "f") : "S");
    return output.join(" ");
}

export function trustedSvgPdfOperations(svg, { offsetX = 0, offsetY = 0, scale = 1, pageHeight = 792 } = {}) {
    if (!validateTrustedSvgContent(svg)) throw new ValidationError("PDF publishing requires trusted SVG notation.");
    const stack = [DEFAULT_PRESENTATION], operations = [], graphicsStates = new Map();
    const unsupported = svg.match(/<(?:rect|polygon|polyline|image|use|foreignObject|clipPath|mask)\b/i);
    if (unsupported) throw new ValidationError(`PDF publishing does not support visible SVG construct "${unsupported[0].slice(1)}".`);
    for (const match of svg.matchAll(/<\/?g\b[^>]*>|<text\b[^>]*>[\s\S]*?<\/text>|<(?:path|line|circle|ellipse)\b[^>]*>/gi)) {
        const tag = match[0];
        if (/^<\/g/i.test(tag)) { if (stack.length === 1) throw new ValidationError("Published notation contains an unbalanced SVG group."); stack.pop(); continue; }
        const parent = stack.at(-1), state = presentation(parent, tag);
        if (/^<g/i.test(tag)) { stack.push(state); continue; }
        const mapX = value => offsetX + (value + state.translateX) * scale;
        const mapY = value => pageHeight - (offsetY + (value + state.translateY) * scale);
        if (/^<text/i.test(tag)) {
            const markup = tag.replace(/^<text\b[^>]*>|<\/text>$/gi, "");
            if (/<[^>]+>/.test(markup)) throw new ValidationError("PDF publishing does not support nested visible SVG text markup.");
            const text = markup.replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
                .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
                .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&apos;", "'").replaceAll("&amp;", "&");
            const fill = paint(state.fill, state.color, "fill");
            if (fill) {
                const alphaKey = `${number(state.opacity * state.fillOpacity)}:${number(state.opacity * state.strokeOpacity)}`;
                if (!graphicsStates.has(alphaKey)) graphicsStates.set(alphaKey, `GS${graphicsStates.size + 1}`);
                const size = numericAttribute(tag, "font-size", 12) * scale;
                operations.push(`/${graphicsStates.get(alphaKey)} gs ${fill.map(number).join(" ")} rg BT /F1 ${number(size)} Tf ${number(mapX(numericAttribute(tag, "x")))} ${number(mapY(numericAttribute(tag, "y")))} Td (${pdfText(text)}) Tj ET`);
            }
            continue;
        }
        let geometry;
        if (/^<path/i.test(tag)) geometry = pathGeometry(tag, mapX, mapY);
        else if (/^<line/i.test(tag)) geometry = `${number(mapX(numericAttribute(tag, "x1")))} ${number(mapY(numericAttribute(tag, "y1")))} m ${number(mapX(numericAttribute(tag, "x2")))} ${number(mapY(numericAttribute(tag, "y2")))} l`;
        else geometry = ellipseGeometry(tag, mapX, mapY, scale, /^<circle/i.test(tag));
        const paintState = /^<line/i.test(tag) ? Object.freeze({ ...state, fill: "none" }) : state;
        const painted = paintedGeometry(geometry, paintState, scale, graphicsStates);
        if (painted) operations.push(painted);
    }
    if (stack.length !== 1) throw new ValidationError("Published notation contains an unbalanced SVG group.");
    return Object.freeze({
        operations: Object.freeze(operations),
        graphicsStates: Object.freeze([...graphicsStates].map(([alpha, name]) => Object.freeze({ alpha, name })))
    });
}

function pageStream(page) {
    const height = page.profile.height / 100, operations = [], graphicsStates = new Map();
    for (const block of page.blocks) {
        if (block.type === "notation") {
            const converted = trustedSvgPdfOperations(block.svg, { offsetX: block.x / 100, offsetY: block.y / 100, scale: block.metadata.scale / 100, pageHeight: height });
            for (const entry of converted.graphicsStates) if (!graphicsStates.has(entry.alpha)) graphicsStates.set(entry.alpha, `GS${graphicsStates.size + 1}`);
            const localNames = new Map(converted.graphicsStates.map(entry => [entry.name, graphicsStates.get(entry.alpha)]));
            operations.push(...converted.operations.map(value => value.replace(/\/GS\d+ gs/g, name => `/${localNames.get(name.slice(1, -3))} gs`)));
            continue;
        }
        const layout = block.metadata.textLayout;
        if (!layout) throw new ValidationError(`Publication text block "${block.id}" is missing its authoritative text layout.`);
        for (const line of layout.lines) {
            const baseline = height - ((block.y + layout.fontSize + line.yOffset) / 100);
            operations.push(`BT /F1 ${number(layout.fontSize / 100)} Tf ${number(block.x / 100)} ${number(baseline)} Td (${pdfText(line.text || " ")}) Tj ET`);
        }
    }
    return { stream: operations.join("\n"), graphicsStates };
}
function pdf(plan) {
    const objects = [null], reserve = () => { objects.push(""); return objects.length - 1; };
    const catalog = reserve(), pagesRoot = reserve(), font = reserve(), pageIds = [];
    objects[font] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    for (const page of plan.pages) {
        const pageId = reserve(), contentId = reserve(), rendered = pageStream(page), stateObjects = new Map();
        for (const [alpha, name] of rendered.graphicsStates) {
            const [fillAlpha, strokeAlpha] = alpha.split(":");
            const objectId = reserve();
            objects[objectId] = `<< /Type /ExtGState /ca ${fillAlpha} /CA ${strokeAlpha} >>`;
            stateObjects.set(name, objectId);
        }
        const resources = [...stateObjects].map(([name, objectId]) => `/${name} ${objectId} 0 R`).join(" ");
        const w = number(page.profile.width / 100), h = number(page.profile.height / 100);
        objects[contentId] = `<< /Length ${enc.encode(rendered.stream).length} >>\nstream\n${rendered.stream}\nendstream`;
        objects[pageId] = `<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${font} 0 R >> /ExtGState << ${resources} >> >> /Contents ${contentId} 0 R >>`;
        pageIds.push(pageId);
    }
    const info = reserve();
    objects[pagesRoot] = `<< /Type /Pages /Kids [${pageIds.map(value => `${value} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    objects[catalog] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
    objects[info] = `<< /Title (${pdfText(plan.request.title)}) /Author (${pdfText(plan.request.author || plan.request.organization)}) /Subject (${pdfText(plan.request.subtitle)}) /Creator (Music Theory Framework Publishing Core) >>`;
    let body = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", offsets = [0];
    for (let index = 1; index < objects.length; index += 1) { offsets[index] = enc.encode(body).length; body += `${index} 0 obj\n${objects[index]}\nendobj\n`; }
    const xref = enc.encode(body).length;
    body += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return enc.encode(body);
}
export class PdfPublishingStrategy extends PublishingStrategy {
    constructor({ pluginId = "core.publishing.builtins" } = {}) { super({ id: "pdf-vector", pluginId, format: "pdf", mediaType: "application/pdf" }); }
    publish(plan) {
        const content = pdf(plan), asset = new PublishedAsset({
            id: boundedExerciseSetId({ kind: "published-asset", readable: plan.request.filenameBase, identity: { plan: plan.id, format: "pdf" } }),
            filename: `${plan.request.filenameBase}.pdf`, format: "pdf", mediaType: "application/pdf", content,
            metadata: { pageCount: plan.pageCount, deterministicBytes: true, vectorNotation: "trusted SVG paths and primitives with inherited presentation state" }
        });
        return new PublishedDocument({
            id: boundedExerciseSetId({ kind: "published-document", readable: plan.request.filenameBase, identity: { plan: plan.id, format: "pdf" } }),
            plan, assets: [asset], format: "pdf", mediaType: "application/pdf", filename: asset.filename,
            metadata: { adapter: "repository-owned-pdf-1.7", timestamps: false, randomIds: false, taggedPdf: false }
        });
    }
}
