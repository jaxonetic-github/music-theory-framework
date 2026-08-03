import { boundedExerciseSetId } from "../../ExerciseSet/index.js";
import { ValidationError } from "../../Foundation/index.js";
import { validateTrustedSvgContent } from "../../Rendering/index.js";
import { PublishedAsset, PublishedDocument } from "../values.js";
import { PublishingStrategy } from "../PublishingStrategy.js";

const enc = new TextEncoder();
export const PDF_SVG_GEOMETRY_LIMITS = Object.freeze({ coordinate: 10000000, matrixComponent: 10000000, strokeWidth: 100000, angle: 360000 });
const NUMBER_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const NUMBER_PREFIX = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
function finiteNumber(value, context, { min = -PDF_SVG_GEOMETRY_LIMITS.coordinate, max = PDF_SVG_GEOMETRY_LIMITS.coordinate } = {}) {
    const source = typeof value === "number" ? String(value) : String(value ?? ""), normalized = source.trim();
    if (!normalized || !NUMBER_TOKEN.test(normalized)) throw new ValidationError(`${context} has malformed numeric value "${source}".`);
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) throw new ValidationError(`${context} must be finite; received "${source}".`);
    if (parsed < min || parsed > max) throw new ValidationError(`${context} value "${source}" exceeds the safe geometry range ${min} through ${max}.`);
    return parsed;
}
const number = value => finiteNumber(value, "PDF drawing operand").toFixed(3).replace(/\.?0+$/, "");
const matrixNumber = value => finiteNumber(value, "PDF matrix operand", { min: -PDF_SVG_GEOMETRY_LIMITS.matrixComponent, max: PDF_SVG_GEOMETRY_LIMITS.matrixComponent }).toFixed(6).replace(/\.?0+$/, "");
const pdfText = value => String(value)
    .replaceAll("𝄫", "bb").replaceAll("𝄪", "##")
    .replaceAll("♭", "b").replaceAll("♯", "#").replaceAll("♮", " natural ")
    .replaceAll("·", "-")
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
const attribute = (tag, name) => tag.match(new RegExp(`(?:\\s|<)${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
function requiredFiniteAttribute(tag, name, context, constraints) {
    const value = attribute(tag, name);
    if (value === undefined) throw new ValidationError(`${context} is missing required attribute "${name}".`);
    return finiteNumber(value, `${context} attribute "${name}"`, constraints);
}
function optionalFiniteAttribute(tag, name, fallback, context, constraints) {
    const value = attribute(tag, name);
    return value === undefined ? finiteNumber(fallback, `${context} default "${name}"`, constraints) : finiteNumber(value, `${context} attribute "${name}"`, constraints);
}
const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);
const DEFAULT_PRESENTATION = Object.freeze({
    fill: "black", stroke: "none", color: "black", fillOpacity: 1,
    strokeOpacity: 1, opacity: 1, fillRule: "nonzero", strokeWidth: 1,
    strokeLinecap: "butt", strokeLinejoin: "miter",
    matrix: IDENTITY_MATRIX
});

function opacity(value, name, context) {
    return finiteNumber(value, `${context} attribute "${name}"`, { min: 0, max: 1 });
}
function paint(value, color, name) {
    const resolved = value === "currentColor" ? color : value;
    if (resolved === "none") return null;
    const normalized = String(resolved).toLowerCase();
    if (normalized === "black" || normalized === "#000" || normalized === "#000000") return [0, 0, 0];
    if (normalized === "white" || normalized === "#fff" || normalized === "#ffffff") return [1, 1, 1];
    throw new ValidationError(`Published notation uses unsupported ${name} paint "${resolved}".`);
}
function multiplyMatrix(left, right, context = "SVG transform composition") {
    const [a, b, c, d, e, f] = left, [g, h, i, j, k, l] = right;
    return Object.freeze([
        a * g + c * h, b * g + d * h,
        a * i + c * j, b * i + d * j,
        a * k + c * l + e, b * k + d * l + f
    ].map((value, index) => finiteNumber(value, `${context} matrix component ${index + 1}`, { min: -PDF_SVG_GEOMETRY_LIMITS.matrixComponent, max: PDF_SVG_GEOMETRY_LIMITS.matrixComponent })));
}
function transformNumbers(value, name, context) {
    const normalized = String(value).trim();
    if (!normalized) throw new ValidationError(`Published notation has an empty ${name} transform.`);
    const raw = [], expression = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g;
    let cursor = 0;
    for (let match = expression.exec(normalized); match; match = expression.exec(normalized)) {
        const separator = normalized.slice(cursor, match.index);
        if ((cursor === 0 && separator.trim()) || (cursor > 0 && !/^(?:\s+|\s*,\s*)$/.test(separator))) throw new ValidationError(`${context} has malformed separators in ${name}(${value}).`);
        raw.push(match[0]); cursor = expression.lastIndex;
    }
    if (!raw.length || normalized.slice(cursor).trim()) throw new ValidationError(`${context} has malformed ${name}(${value}) operands.`);
    return raw.map((token, index) => finiteNumber(token, `${context} ${name} operand ${index + 1}`, { min: -PDF_SVG_GEOMETRY_LIMITS.matrixComponent, max: PDF_SVG_GEOMETRY_LIMITS.matrixComponent }));
}
function transformMatrix(name, value, context) {
    const values = transformNumbers(value, name, context);
    if (name === "translate" && (values.length === 1 || values.length === 2)) return Object.freeze([1, 0, 0, 1, values[0], values[1] ?? 0]);
    if (name === "scale" && (values.length === 1 || values.length === 2)) return Object.freeze([values[0], 0, 0, values[1] ?? values[0], 0, 0]);
    if (name === "matrix" && values.length === 6) return Object.freeze(values);
    if (name === "rotate" && (values.length === 1 || values.length === 3)) {
        finiteNumber(values[0], `${context} rotate angle`, { min: -PDF_SVG_GEOMETRY_LIMITS.angle, max: PDF_SVG_GEOMETRY_LIMITS.angle });
        const radians = values[0] * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
        const rotation = Object.freeze([cosine, sine, -sine, cosine, 0, 0]);
        if (values.length === 1) return rotation;
        const [, cx, cy] = values;
        return multiplyMatrix(
            Object.freeze([1, 0, 0, 1, cx, cy]),
            multiplyMatrix(rotation, Object.freeze([1, 0, 0, 1, -cx, -cy]), context), context
        );
    }
    throw new ValidationError(`Published notation uses malformed or unsupported ${name}(${value}) transform.`);
}
export function parseSvgTransform(value = "", context = "Published notation transform") {
    const source = String(value).trim();
    if (!source) return IDENTITY_MATRIX;
    let matrix = IDENTITY_MATRIX, cursor = 0;
    const expression = /([A-Za-z]+)\s*\(([^)]*)\)/g;
    for (let match = expression.exec(source); match; match = expression.exec(source)) {
        if (source.slice(cursor, match.index).trim().replaceAll(",", "")) throw new ValidationError(`Published notation has malformed transform list "${source}".`);
        const name = match[1].toLowerCase();
        if (!["translate", "scale", "rotate", "matrix"].includes(name)) throw new ValidationError(`Published notation uses unsupported transform "${match[1]}".`);
        matrix = multiplyMatrix(matrix, transformMatrix(name, match[2], context), context);
        cursor = expression.lastIndex;
    }
    if (cursor === 0 || source.slice(cursor).trim().replaceAll(",", "")) throw new ValidationError(`Published notation has malformed transform list "${source}".`);
    return matrix;
}
function presentation(parent, tag, context) {
    const color = attribute(tag, "color") ?? parent.color;
    const fillRule = attribute(tag, "fill-rule") ?? parent.fillRule;
    if (!["nonzero", "evenodd"].includes(fillRule)) throw new ValidationError(`Published notation uses unsupported fill-rule "${fillRule}".`);
    const localMatrix = parseSvgTransform(attribute(tag, "transform") ?? "", context);
    const localOpacity = attribute(tag, "opacity") === undefined ? 1 : opacity(attribute(tag, "opacity"), "opacity", context);
    return Object.freeze({
        fill: attribute(tag, "fill") ?? parent.fill,
        stroke: attribute(tag, "stroke") ?? parent.stroke,
        color,
        fillOpacity: attribute(tag, "fill-opacity") === undefined ? parent.fillOpacity : opacity(attribute(tag, "fill-opacity"), "fill-opacity", context),
        strokeOpacity: attribute(tag, "stroke-opacity") === undefined ? parent.strokeOpacity : opacity(attribute(tag, "stroke-opacity"), "stroke-opacity", context),
        opacity: finiteNumber(parent.opacity * localOpacity, `${context} computed opacity`, { min: 0, max: 1 }),
        fillRule,
        strokeWidth: optionalFiniteAttribute(tag, "stroke-width", parent.strokeWidth, context, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.strokeWidth }),
        strokeLinecap: attribute(tag, "stroke-linecap") ?? parent.strokeLinecap,
        strokeLinejoin: attribute(tag, "stroke-linejoin") ?? parent.strokeLinejoin,
        matrix: multiplyMatrix(parent.matrix, localMatrix, context)
    });
}
function lineStyle(state) {
    const caps = { butt: 0, round: 1, square: 2 }, joins = { miter: 0, round: 1, bevel: 2 };
    if (!(state.strokeLinecap in caps)) throw new ValidationError(`Published notation uses unsupported stroke-linecap "${state.strokeLinecap}".`);
    if (!(state.strokeLinejoin in joins)) throw new ValidationError(`Published notation uses unsupported stroke-linejoin "${state.strokeLinejoin}".`);
    return `${caps[state.strokeLinecap]} J ${joins[state.strokeLinejoin]} j`;
}
function pathTokens(data, context) {
    const source = String(data ?? "");
    if (!source.trim()) throw new ValidationError(`${context} is missing non-empty path data.`);
    if (/[,]\s*$/.test(source)) throw new ValidationError(`${context} path data has a trailing separator.`);
    const tokens = [];
    for (let index = 0; index < source.length;) {
        const character = source[index];
        if (/[\s,]/.test(character)) { index += 1; continue; }
        if (/[A-Za-z]/.test(character)) { tokens.push(Object.freeze({ type: "command", value: character, index })); index += 1; continue; }
        const match = source.slice(index).match(NUMBER_PREFIX);
        if (!match) throw new ValidationError(`${context} path data has unexpected token at character ${index + 1}: "${source.slice(index, index + 12)}".`);
        tokens.push(Object.freeze({ type: "number", value: finiteNumber(match[0], `${context} path operand at character ${index + 1}`), raw: match[0], index }));
        index += match[0].length;
    }
    return Object.freeze(tokens);
}
function safeCoordinate(value, context) { return finiteNumber(value, context); }
function pathGeometry(tag, context) {
    const data = attribute(tag, "d");
    if (data === undefined) throw new ValidationError(`${context} is missing required attribute "d".`);
    const tokens = pathTokens(data, context), out = [], points = [];
    let index = 0, command = null, cx = 0, cy = 0, sx = 0, sy = 0, moved = false;
    const point = (x, y) => { points.push(Object.freeze([x, y])); return `${number(x)} ${number(y)}`; };
    const operands = (count, active) => {
        const values = [];
        for (let operand = 0; operand < count; operand += 1) {
            const token = tokens[index];
            if (!token || token.type !== "number") throw new ValidationError(`${context} path command "${active}" is truncated at operand ${operand + 1} of ${count}.`);
            values.push(token.value); index += 1;
        }
        return values;
    };
    while (index < tokens.length) {
        if (tokens[index].type === "command") command = tokens[index++].value;
        else if (!command) throw new ValidationError(`${context} path has a numeric operand without an active command.`);
        const relative = command === command.toLowerCase(), upper = command.toUpperCase();
        if (!moved && upper !== "M") throw new ValidationError(`${context} path must begin with an M or m command; received "${command}".`);
        if (!["M", "L", "H", "V", "C", "Z"].includes(upper)) throw new ValidationError(`${context} path uses unsupported command "${command}".`);
        if (upper === "Z") {
            out.push("h"); cx = sx; cy = sy; command = null;
            continue;
        }
        if (upper === "M" || upper === "L") {
            const [px, py] = operands(2, command);
            cx = safeCoordinate(relative ? cx + px : px, `${context} command "${command}" x coordinate`);
            cy = safeCoordinate(relative ? cy + py : py, `${context} command "${command}" y coordinate`);
            if (upper === "M") { sx = cx; sy = cy; moved = true; }
            out.push(`${point(cx, cy)} ${upper === "M" ? "m" : "l"}`);
            if (upper === "M") command = relative ? "l" : "L";
        } else if (upper === "H") {
            const [value] = operands(1, command); cx = safeCoordinate(relative ? cx + value : value, `${context} command "${command}" x coordinate`); out.push(`${point(cx, cy)} l`);
        } else if (upper === "V") {
            const [value] = operands(1, command); cy = safeCoordinate(relative ? cy + value : value, `${context} command "${command}" y coordinate`); out.push(`${point(cx, cy)} l`);
        } else {
            const values = operands(6, command);
            const x1 = safeCoordinate(relative ? cx + values[0] : values[0], `${context} command "${command}" control x1`), y1 = safeCoordinate(relative ? cy + values[1] : values[1], `${context} command "${command}" control y1`);
            const x2 = safeCoordinate(relative ? cx + values[2] : values[2], `${context} command "${command}" control x2`), y2 = safeCoordinate(relative ? cy + values[3] : values[3], `${context} command "${command}" control y2`);
            const x3 = safeCoordinate(relative ? cx + values[4] : values[4], `${context} command "${command}" x coordinate`), y3 = safeCoordinate(relative ? cy + values[5] : values[5], `${context} command "${command}" y coordinate`);
            out.push(`${point(x1, y1)} ${point(x2, y2)} ${point(x3, y3)} c`); cx = x3; cy = y3;
        }
    }
    if (!moved) throw new ValidationError(`${context} path does not contain a valid move command.`);
    return Object.freeze({ geometry: out.join(" "), points: Object.freeze(points) });
}
function ellipseGeometry(tag, circle, context) {
    const cx = requiredFiniteAttribute(tag, "cx", context), cy = requiredFiniteAttribute(tag, "cy", context);
    const rx = requiredFiniteAttribute(tag, circle ? "r" : "rx", context, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.coordinate });
    const ry = circle ? rx : requiredFiniteAttribute(tag, "ry", context, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.coordinate }), k = .5522847498;
    const points = [[cx + rx, cy], [cx + rx, cy + k * ry], [cx + k * rx, cy + ry], [cx, cy + ry], [cx - k * rx, cy + ry], [cx - rx, cy + k * ry], [cx - rx, cy], [cx - rx, cy - k * ry], [cx - k * rx, cy - ry], [cx, cy - ry], [cx + k * rx, cy - ry], [cx + rx, cy - k * ry]].map(([x, y], index) => Object.freeze([safeCoordinate(x, `${context} ellipse point ${index + 1} x`), safeCoordinate(y, `${context} ellipse point ${index + 1} y`)]));
    return Object.freeze({ geometry: `${number(cx + rx)} ${number(cy)} m ${number(cx + rx)} ${number(cy + k * ry)} ${number(cx + k * rx)} ${number(cy + ry)} ${number(cx)} ${number(cy + ry)} c ${number(cx - k * rx)} ${number(cy + ry)} ${number(cx - rx)} ${number(cy + k * ry)} ${number(cx - rx)} ${number(cy)} c ${number(cx - rx)} ${number(cy - k * ry)} ${number(cx - k * rx)} ${number(cy - ry)} ${number(cx)} ${number(cy - ry)} c ${number(cx + k * rx)} ${number(cy - ry)} ${number(cx + rx)} ${number(cy - k * ry)} ${number(cx + rx)} ${number(cy)} c`, points: Object.freeze(points) });
}
function validateTransformedPoints(matrix, points, context) {
    const [a, b, c, d, e, f] = matrix;
    for (let index = 0; index < points.length; index += 1) {
        const [x, y] = points[index];
        finiteNumber(a * x + c * y + e, `${context} transformed point ${index + 1} x`);
        finiteNumber(b * x + d * y + f, `${context} transformed point ${index + 1} y`);
    }
}
function validateTransformedStroke(matrix, state, context) {
    if (state.stroke === "none" || state.strokeWidth === 0) return;
    const [a, b, c, d] = matrix, xScale = Math.hypot(a, b), yScale = Math.hypot(c, d);
    finiteNumber(state.strokeWidth * xScale, `${context} transformed stroke width x`, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.strokeWidth });
    finiteNumber(state.strokeWidth * yScale, `${context} transformed stroke width y`, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.strokeWidth });
}
function matrixOperator(matrix) { return matrix.map(matrixNumber).join(" "); }
function paintedGeometry(geometry, state, matrix, graphicsStates) {
    const fill = paint(state.fill, state.color, "fill"), stroke = paint(state.stroke, state.color, "stroke");
    if (!fill && !stroke) return "";
    const fillAlpha = state.opacity * state.fillOpacity, strokeAlpha = state.opacity * state.strokeOpacity;
    const alphaKey = `${number(fillAlpha)}:${number(strokeAlpha)}`;
    if (!graphicsStates.has(alphaKey)) graphicsStates.set(alphaKey, `GS${graphicsStates.size + 1}`);
    const output = [`q ${matrixOperator(matrix)} cm`, `/${graphicsStates.get(alphaKey)} gs`];
    if (fill) output.push(`${fill.map(number).join(" ")} rg`);
    if (stroke) output.push(`${stroke.map(number).join(" ")} RG`, `${number(state.strokeWidth)} w`, lineStyle(state));
    output.push(geometry, fill && stroke ? (state.fillRule === "evenodd" ? "B*" : "B") : fill ? (state.fillRule === "evenodd" ? "f*" : "f") : "S", "Q");
    return output.join(" ");
}

export function trustedSvgPdfOperations(svg, { offsetX = 0, offsetY = 0, scale = 1, pageHeight = 792, context = "notation SVG" } = {}) {
    if (!validateTrustedSvgContent(svg)) throw new ValidationError("PDF publishing requires trusted SVG notation.");
    offsetX = finiteNumber(offsetX, `${context} page offset x`); offsetY = finiteNumber(offsetY, `${context} page offset y`);
    scale = finiteNumber(scale, `${context} page scale`, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.matrixComponent });
    pageHeight = finiteNumber(pageHeight, `${context} page height`, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.coordinate });
    const pageMatrix = Object.freeze([scale, 0, 0, -scale, offsetX, safeCoordinate(pageHeight - offsetY, `${context} page translation y`)]);
    const stack = [DEFAULT_PRESENTATION], drawings = [];
    const unsupported = svg.match(/<(?:rect|polygon|polyline|image|use|foreignObject|clipPath|mask)\b/i);
    if (unsupported) throw new ValidationError(`${context} does not support visible SVG construct "${unsupported[0].slice(1)}".`);
    let elementIndex = 0;
    for (const match of svg.matchAll(/<\/?g\b[^>]*>|<text\b[^>]*>[\s\S]*?<\/text>|<(?:path|line|circle|ellipse)\b[^>]*>/gi)) {
        const tag = match[0], elementName = tag.match(/^<\/?([A-Za-z]+)/)?.[1]?.toLowerCase() ?? "element";
        if (/^<\/g/i.test(tag)) { if (stack.length === 1) throw new ValidationError("Published notation contains an unbalanced SVG group."); stack.pop(); continue; }
        elementIndex += 1;
        const elementContext = `${context}, <${elementName}> element ${elementIndex}`, parent = stack.at(-1), state = presentation(parent, tag, elementContext);
        if (/^<g/i.test(tag)) { stack.push(state); continue; }
        const matrix = multiplyMatrix(pageMatrix, state.matrix, elementContext);
        if (/^<text/i.test(tag)) {
            const markup = tag.replace(/^<text\b[^>]*>|<\/text>$/gi, "");
            if (/<[^>]+>/.test(markup)) throw new ValidationError("PDF publishing does not support nested visible SVG text markup.");
            const text = markup.replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
                .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
                .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&apos;", "'").replaceAll("&amp;", "&");
            const size = optionalFiniteAttribute(tag, "font-size", 12, elementContext, { min: 0, max: PDF_SVG_GEOMETRY_LIMITS.strokeWidth });
            const x = requiredFiniteAttribute(tag, "x", elementContext), y = requiredFiniteAttribute(tag, "y", elementContext);
            validateTransformedPoints(matrix, [[x, y]], elementContext);
            drawings.push(Object.freeze({ kind: "text", text, size, x, y, state, matrix, context: elementContext }));
            continue;
        }
        let geometry;
        if (/^<path/i.test(tag)) geometry = pathGeometry(tag, elementContext);
        else if (/^<line/i.test(tag)) {
            const x1 = requiredFiniteAttribute(tag, "x1", elementContext), y1 = requiredFiniteAttribute(tag, "y1", elementContext), x2 = requiredFiniteAttribute(tag, "x2", elementContext), y2 = requiredFiniteAttribute(tag, "y2", elementContext);
            geometry = Object.freeze({ geometry: `${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l`, points: Object.freeze([Object.freeze([x1, y1]), Object.freeze([x2, y2])]) });
        } else geometry = ellipseGeometry(tag, /^<circle/i.test(tag), elementContext);
        validateTransformedPoints(matrix, geometry.points, elementContext);
        const paintState = /^<line/i.test(tag) ? Object.freeze({ ...state, fill: "none" }) : state;
        validateTransformedStroke(matrix, paintState, elementContext);
        drawings.push(Object.freeze({ kind: "geometry", geometry: geometry.geometry, state: paintState, matrix, context: elementContext }));
    }
    if (stack.length !== 1) throw new ValidationError("Published notation contains an unbalanced SVG group.");
    const operations = [], graphicsStates = new Map();
    for (const drawing of Object.freeze(drawings)) {
        if (drawing.kind === "geometry") {
            const painted = paintedGeometry(drawing.geometry, drawing.state, drawing.matrix, graphicsStates);
            if (painted) operations.push(painted);
            continue;
        }
        const fill = paint(drawing.state.fill, drawing.state.color, "fill");
        if (!fill) continue;
        const alphaKey = `${number(drawing.state.opacity * drawing.state.fillOpacity)}:${number(drawing.state.opacity * drawing.state.strokeOpacity)}`;
        if (!graphicsStates.has(alphaKey)) graphicsStates.set(alphaKey, `GS${graphicsStates.size + 1}`);
        operations.push(`q ${matrixOperator(drawing.matrix)} cm /${graphicsStates.get(alphaKey)} gs ${fill.map(number).join(" ")} rg BT /F1 ${number(drawing.size)} Tf 1 0 0 -1 ${number(drawing.x)} ${number(drawing.y)} Tm (${pdfText(drawing.text)}) Tj ET Q`);
    }
    return Object.freeze({
        operations: Object.freeze(operations),
        graphicsStates: Object.freeze([...graphicsStates].map(([alpha, name]) => Object.freeze({ alpha, name })))
    });
}

function pageStream(page) {
    const height = page.profile.height / 100, operations = [], graphicsStates = new Map();
    for (const block of page.blocks) {
        if (block.type === "notation") {
            const source = block.source, sourceContext = [`page ${page.number}`, `block "${block.id}"`, source.sectionId ? `section "${source.sectionId}"` : "", source.itemId ? `item "${source.itemId}"` : "", source.rowId ? `row "${source.rowId}"` : "", source.systemIds?.length ? `systems "${source.systemIds.join(",")}"` : ""].filter(Boolean).join(", ");
            const converted = trustedSvgPdfOperations(block.svg, { offsetX: block.x / 100, offsetY: block.y / 100, scale: block.metadata.scale / 100, pageHeight: height, context: sourceContext });
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
    const stream = operations.join("\n"), numericStream = stream.replace(/\((?:\\.|[^)])*\)/g, "()");
    if (/(?:^|[\s\[])\+?(?:NaN|Infinity|undefined|null)(?=$|[\s\]])/i.test(numericStream)) throw new ValidationError(`PDF page ${page.number} drawing stream contains a non-finite or undefined operand.`);
    return { stream, graphicsStates };
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
