import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { resolveLayoutProfile } from "./profiles.js";

const keys = new Set(["score", "availableWidth", "profile", "horizontalPadding", "minimumSystemWidth", "staffSpacing", "systemSpacing", "semanticSystems", "pluginId", "strategyId"]);
export class LayoutRequest {
    constructor(value = {}) {
        if (value instanceof LayoutRequest) return value;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("LayoutRequest must be an object.");
        const unknown = Object.keys(value).filter(key => !keys.has(key)); if (unknown.length) throw new ValidationError(`Unknown layout request options: ${unknown.join(", ")}.`);
        if (!(value.score instanceof ScoreGraph)) throw new ValidationError("LayoutRequest score must be an immutable ScoreGraph.");
        const availableWidth = Number(value.availableWidth ?? 1200); if (!Number.isFinite(availableWidth) || availableWidth < 160 || availableWidth > 10000) throw new ValidationError("Layout availableWidth must be between 160 and 10000 layout units.");
        const profile = resolveLayoutProfile(value.profile);
        const horizontalPadding = Number(value.horizontalPadding ?? 24), minimumSystemWidth = Number(value.minimumSystemWidth ?? 160);
        const staffSpacing = Number(value.staffSpacing ?? profile.staffSpacing), systemSpacing = Number(value.systemSpacing ?? profile.systemSpacing);
        for (const [field, number] of Object.entries({ horizontalPadding, minimumSystemWidth, staffSpacing, systemSpacing })) if (!Number.isFinite(number) || number < 0) throw new ValidationError(`Layout ${field} must be a non-negative finite number.`);
        if (minimumSystemWidth < 80 || minimumSystemWidth > availableWidth) throw new ValidationError("Layout minimumSystemWidth must be at least 80 and no greater than availableWidth.");
        if (horizontalPadding * 2 >= availableWidth) throw new ValidationError("Layout horizontalPadding leaves no usable system width.");
        const measureIds = new Set(value.score.nodesOfType("measure").map(node => String(node.id))), seen = new Set();
        const semanticSystems = (value.semanticSystems ?? []).map((system, index) => {
            if (!system || typeof system !== "object" || Array.isArray(system) || !String(system.id ?? "").trim() || !Array.isArray(system.measureIds) || !system.measureIds.length) throw new ValidationError(`Layout semantic system ${index + 1} is malformed.`);
            const ids = system.measureIds.map(String); for (const id of ids) { if (!measureIds.has(id)) throw new ValidationError(`Layout semantic system "${system.id}" references unknown measure "${id}".`); if (seen.has(id)) throw new ValidationError(`Layout semantic measure "${id}" occurs more than once.`); seen.add(id); }
            const breakPolicy = String(system.breakPolicy ?? "wrappable"); if (!["mandatory", "wrappable"].includes(breakPolicy)) throw new ValidationError(`Layout semantic system "${system.id}" has an invalid breakPolicy.`);
            return Object.freeze({ id: String(system.id), measureIds: Object.freeze(ids), breakPolicy });
        });
        const pluginId = value.pluginId == null ? null : String(value.pluginId), strategyId = value.strategyId == null ? null : String(value.strategyId); if (strategyId && !pluginId) throw new ValidationError("Layout strategyId requires pluginId.");
        Object.defineProperties(this, { score: { value: value.score, enumerable: true }, availableWidth: { value: availableWidth, enumerable: true }, profile: { value: profile, enumerable: true }, horizontalPadding: { value: horizontalPadding, enumerable: true }, minimumSystemWidth: { value: minimumSystemWidth, enumerable: true }, staffSpacing: { value: staffSpacing, enumerable: true }, systemSpacing: { value: systemSpacing, enumerable: true }, semanticSystems: { value: freezeDeep(cloneDeep(semanticSystems)), enumerable: true }, pluginId: { value: pluginId, enumerable: true }, strategyId: { value: strategyId, enumerable: true } }); Object.freeze(this);
    }
    static from(value) { return value instanceof LayoutRequest ? value : new LayoutRequest(value); }
}
