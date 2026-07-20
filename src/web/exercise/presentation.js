import { ExerciseApplicationResult } from "../../core/index.js";

const SVG_FORMAT = "svg";
const SVG_MEDIA_TYPE = "image/svg+xml";
const svgDocument = /^\s*<svg(?:\s|>)[\s\S]*<\/svg>\s*$/i;

export function validateExercisePresentation(result) {
    if (!(result instanceof ExerciseApplicationResult)) throw new TypeError("A completed ExerciseApplicationResult is required.");
    const document = result.presentation;
    if (document.request !== result.request || document.model !== result.model) throw new TypeError("Presentation ownership does not match the completed result.");
    const renderer = document.metadata?.rendering;
    if (!renderer || renderer.format !== SVG_FORMAT || renderer.mediaType !== SVG_MEDIA_TYPE || !renderer.pluginId || !renderer.strategyId) {
        throw new TypeError("The completed presentation does not identify the supported SVG renderer.");
    }
    for (const section of document.sections) {
        for (const row of section.rows) {
            if (row.format !== SVG_FORMAT || row.mediaType !== SVG_MEDIA_TYPE) throw new TypeError(`Row "${row.id}" has unsupported presentation content.`);
            if (row.rendererPluginId !== renderer.pluginId || row.rendererStrategyId !== renderer.strategyId || row.metadata?.renderer?.format !== SVG_FORMAT || row.metadata?.renderer?.pluginId !== renderer.pluginId || row.metadata?.renderer?.strategyId !== renderer.strategyId) {
                throw new TypeError(`Row "${row.id}" renderer metadata does not match the completed presentation.`);
            }
            if (typeof row.content !== "string" || !row.content.trim() || !svgDocument.test(row.content) || /<(?:script|foreignObject)\b|\son[a-z]+\s*=/i.test(row.content)) {
                throw new TypeError(`Row "${row.id}" does not contain trusted internal SVG.`);
            }
        }
    }
    return document;
}
