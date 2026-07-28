const svgDocument = /^\s*<svg(?:\s|>)[\s\S]*<\/svg>\s*$/i;
const activeElement = /<(?:[a-z][\w.-]*:)?(?:script|foreignObject|iframe|object|embed|html|body|link|meta|base|form|input|button|textarea|select|video|audio|source)\b/i;
const eventHandler = /\s(?:[a-z][\w.-]*:)?on[a-z0-9_.:-]*\s*=/i;
const hrefAttribute = /\s(?:xlink:href|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const safeFragment = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;

export function validateTrustedSvgContent(content) {
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
