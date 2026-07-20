import { ExerciseApplicationResult } from "../../core/index.js";

const SVG_FORMAT = "svg";
const SVG_MEDIA_TYPE = "image/svg+xml";
const SVG_PLUGIN_ID = "core.rendering.svg";
const SVG_STRATEGY_ID = "svg";
const svgDocument = /^\s*<svg(?:\s|>)[\s\S]*<\/svg>\s*$/i;
const activeElement = /<(?:[a-z][\w.-]*:)?(?:script|foreignObject|iframe|object|embed|html|body|link|meta|base|form|input|button|textarea|select|video|audio|source)\b/i;
const eventHandler = /\s(?:[a-z][\w.-]*:)?on[a-z0-9_.:-]*\s*=/i;
const hrefAttribute = /\s(?:xlink:href|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const safeFragment = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;

function trustedSvg(content) {
    if (typeof content !== "string" || !content.trim() || !svgDocument.test(content)) return false;
    if (/<\?|<!doctype\b/i.test(content) || activeElement.test(content) || eventHandler.test(content)) return false;
    if (/<style\b|\sstyle\s*=|@import\b|url\s*\(/i.test(content)) return false;
    const withoutNamespace = content.replace(/\sxmlns(?::[\w.-]+)?\s*=\s*(["'])http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)\1/gi, "");
    if (/(?:javascript|data|https?):\s*|(?:^|[\s"'=])\/\//i.test(withoutNamespace)) return false;
    hrefAttribute.lastIndex = 0;
    for (let match = hrefAttribute.exec(content); match; match = hrefAttribute.exec(content)) {
        if (!safeFragment.test(match[1] ?? match[2] ?? match[3] ?? "")) return false;
    }
    return true;
}

export function validateExercisePresentation(result) {
    if (!(result instanceof ExerciseApplicationResult)) throw new TypeError("A completed ExerciseApplicationResult is required.");
    const document = result.presentation;
    if (document.request !== result.request || document.model !== result.model || document.notationDocument !== result.notationDocument) throw new TypeError("Presentation ownership does not match the completed result.");
    const renderer = document.metadata?.rendering;
    const resultRenderer = result.metadata?.rendering;
    if (!renderer || !resultRenderer || renderer.format !== SVG_FORMAT || renderer.mediaType !== SVG_MEDIA_TYPE || renderer.pluginId !== SVG_PLUGIN_ID || renderer.strategyId !== SVG_STRATEGY_ID
        || resultRenderer.format !== SVG_FORMAT || resultRenderer.mediaType !== SVG_MEDIA_TYPE || resultRenderer.pluginId !== SVG_PLUGIN_ID || resultRenderer.strategyId !== SVG_STRATEGY_ID) {
        throw new TypeError("The completed presentation does not identify the approved internal SVG renderer.");
    }
    for (const section of document.sections) {
        for (const row of section.rows) {
            if (row.format !== SVG_FORMAT || row.mediaType !== SVG_MEDIA_TYPE) throw new TypeError(`Row "${row.id}" has unsupported presentation content.`);
            if (row.rendererPluginId !== SVG_PLUGIN_ID || row.rendererStrategyId !== SVG_STRATEGY_ID || row.metadata?.renderer?.format !== SVG_FORMAT || row.metadata?.renderer?.pluginId !== SVG_PLUGIN_ID || row.metadata?.renderer?.strategyId !== SVG_STRATEGY_ID) {
                throw new TypeError(`Row "${row.id}" renderer metadata does not match the completed presentation.`);
            }
            if (!trustedSvg(row.content)) {
                throw new TypeError(`Row "${row.id}" does not contain trusted internal SVG.`);
            }
        }
    }
    return document;
}
