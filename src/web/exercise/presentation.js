import { ExerciseApplicationResult, validateTrustedSvgContent } from "../../core/index.js";

const SVG_FORMAT = "svg";
const SVG_MEDIA_TYPE = "image/svg+xml";
const SVG_PLUGIN_ID = "core.rendering.svg";
const SVG_STRATEGY_ID = "svg";
export { validateTrustedSvgContent };

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
            if (!validateTrustedSvgContent(row.content)) {
                throw new TypeError(`Row "${row.id}" does not contain trusted internal SVG.`);
            }
        }
    }
    return document;
}
