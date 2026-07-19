import { ApplicationResult, ExportResult } from "../core/index.js";

export function safeFilename(value) {
    const normalized = String(value ?? "music-theory")
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^[.-]+/, "")
        .replace(/[.-]+$/, "")
        .toLowerCase();
    return normalized || "music-theory";
}

export function exportFilenameBase(result) {
    if (!(result instanceof ApplicationResult) || !result.export) {
        throw new TypeError("A completed ApplicationResult with an export is required for a filename.");
    }
    return safeFilename(`${result.request.root}-${result.request.type}`);
}

export function downloadExport(result, {
    filenameBase,
    documentObject = globalThis.document,
    urlObject = globalThis.URL,
    BlobType = globalThis.Blob
} = {}) {
    if (!(result instanceof ExportResult)) throw new TypeError("A completed ExportResult is required for download.");
    if (!documentObject?.createElement || !urlObject?.createObjectURL || !urlObject?.revokeObjectURL || !BlobType) {
        throw new Error("The browser download APIs are unavailable.");
    }
    const blob = new BlobType([result.content], { type: result.mediaType });
    const url = urlObject.createObjectURL(blob);
    const anchor = documentObject.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(filenameBase)}.${result.extension}`;
    anchor.hidden = true;
    try {
        documentObject.body.append(anchor);
        anchor.click();
    } finally {
        anchor.remove();
        urlObject.revokeObjectURL(url);
    }
}
