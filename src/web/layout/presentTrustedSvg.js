import { validateTrustedSvgContent } from "../exercise/presentation.js";

function safePrefix(value) {
    const result = String(value ?? "").trim().replace(/[^A-Za-z0-9_.:-]/g, "-");
    if (!result) throw new TypeError("An accessibility SVG ID prefix is required.");
    return result;
}

export function presentTrustedSvg(content, prefix) {
    if (!validateTrustedSvgContent(content)) throw new TypeError("Notation presentation requires trusted SVG content.");
    const title = /<title id="([^"]+)">/.exec(content);
    const description = /<desc id="([^"]+)">/.exec(content);
    if (!title || !description) throw new TypeError("Trusted notation SVG requires accessible title and description IDs.");
    const id = safePrefix(prefix), titleId = `${id}-score-title`, descriptionId = `${id}-score-description`;
    let result = content
        .replace(/<title id="[^"]+">/, `<title id="${titleId}">`)
        .replace(/<desc id="[^"]+">/, `<desc id="${descriptionId}">`)
        .replace(/^(\s*<svg\b[^>]*?)>/, (_, opening) => {
            let next = opening.replace(/\saria-labelledby="[^"]*"/, ` aria-labelledby="${titleId}"`);
            next = /\saria-describedby="[^"]*"/.test(next)
                ? next.replace(/\saria-describedby="[^"]*"/, ` aria-describedby="${descriptionId}"`)
                : `${next} aria-describedby="${descriptionId}"`;
            return `${next}>`;
        });
    if (!validateTrustedSvgContent(result)) throw new TypeError("Instance-safe notation SVG failed trusted-content validation.");
    return result;
}
