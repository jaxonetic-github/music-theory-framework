import { ValidationError } from "../Foundation/index.js";
import { ScoreGraph } from "../Notation/index.js";
import { ExerciseNotationDocument } from "./ExerciseNotationDocument.js";
import { ExerciseNotationRequest } from "./ExerciseNotationRequest.js";
import { ExerciseNotationRow } from "./ExerciseNotationRow.js";
import { ExerciseNotationSection } from "./ExerciseNotationSection.js";
import { ExerciseNotationSystem } from "./ExerciseNotationSystem.js";

function identity(request) { return `exercise-notation:${request.model.id}:duration:${request.duration}:clef:${request.clef}:time:${request.timeSignature.beats}-${request.timeSignature.beatUnit}:systems:${request.measuresPerSystem}:key:${request.keySignaturePolicy}${request.keySignature ? `-${request.keySignature}` : ""}`; }
function complete(graph, request) {
    const events = graph.nodes.filter(node => ["note", "chord"].includes(String(node.type)));
    const lastMeasure = graph.nodesOfType("measure").at(-1); const voice = graph.edges.find(edge => String(edge.from) === String(lastMeasure.id) && String(edge.type) === "contains");
    const count = graph.edges.filter(edge => String(edge.from) === String(voice?.to) && String(edge.type) === "contains").length;
    const usedN = BigInt(count) * BigInt(request.duration.numerator) * BigInt(request.timeSignature.beatUnit);
    const capacityN = BigInt(request.duration.denominator) * BigInt(request.timeSignature.beats);
    return { events, finalComplete: usedN === capacityN };
}
function validateGraph(graph, request, section, row) {
    const actual = graph.nodes.filter(node => ["note", "chord"].includes(String(node.type))).sort((a, b) => a.offset - b.offset || String(a.id).localeCompare(String(b.id)));
    const expected = row.steps.flatMap(step => step.simultaneous ? [{ step, notes: step.notes, emittedIndex: 1, chord: true }] : step.notes.map((note, index) => ({ step, notes: [note], emittedIndex: index + 1, chord: false })));
    if (actual.length !== expected.length) throw new ValidationError(`Exercise notation strategy "${row.id}" returned an incorrect event count.`);
    actual.forEach((node, index) => {
        const source = node.metadata.attributes, target = expected[index];
        if (source.modelId !== request.model.id || source.sectionId !== section.id || source.rowId !== row.id || source.stepId !== target.step.id || source.sourceId !== target.step.sourceId || source.emittedIndex !== target.emittedIndex) throw new ValidationError(`Exercise notation strategy returned mismatched source identity for row "${row.id}".`);
        if (String(node.type) !== (target.chord ? "chord" : "note") || String(node.duration) !== String(request.duration)) throw new ValidationError(`Exercise notation strategy returned mismatched event shape for row "${row.id}".`);
        const pitches = target.chord ? node.notes.map(String) : [String(node.pitch)]; if (pitches.length !== target.notes.length || pitches.some((pitch, position) => pitch !== String(target.notes[position]))) throw new ValidationError(`Exercise notation strategy returned mismatched pitches for row "${row.id}".`);
    });
}
export class ExerciseNotationEngine {
    constructor(registry) { if (!registry || typeof registry.select !== "function") throw new ValidationError("ExerciseNotationEngine requires a NotationStrategyRegistry."); this.registry = registry; Object.seal(this); }
    notate(modelOrRequest, options = {}) {
        const request = modelOrRequest instanceof ExerciseNotationRequest ? modelOrRequest : new ExerciseNotationRequest({ ...options, model: modelOrRequest });
        const firstRow = request.model.sections[0]?.rows[0];
        const selection = { ...(request.pluginId ? { pluginId: request.pluginId } : {}), ...(request.strategyId ? { strategyId: request.strategyId } : {}) };
        const strategy = this.registry.select(firstRow, selection); if (!strategy) throw new ValidationError("No notation strategy supports ExerciseRow input.");
        const sections = request.model.sections.map(section => {
            const rows = section.rows.map(row => {
                const graph = strategy.notate(row, { request, sectionId: section.id }); if (!(graph instanceof ScoreGraph)) throw new ValidationError(`Exercise notation strategy "${strategy.id}" did not return a ScoreGraph.`);
                validateGraph(graph, request, section, row);
                const measures = graph.nodesOfType("measure"); const systems = [];
                for (let index = 0; index < measures.length; index += request.measuresPerSystem) systems.push(new ExerciseNotationSystem({ id: `${request.model.id}:${section.id}:${row.id}:system:${systems.length + 1}`, sequence: systems.length + 1, measureIds: measures.slice(index, index + request.measuresPerSystem).map(value => String(value.id)), metadata: { measuresPerSystem: request.measuresPerSystem } }));
                const state = complete(graph, request);
                return new ExerciseNotationRow({ id: `${request.model.id}:${section.id}:${row.id}:notation`, sourceRow: row, graph, systems, measureCount: measures.length, eventCount: state.events.length, finalMeasureComplete: state.finalComplete, metadata: { modelId: request.model.id, sectionId: section.id, pluginId: String(strategy.pluginId), strategyId: String(strategy.id) } });
            });
            return new ExerciseNotationSection({ id: `${request.model.id}:${section.id}:notation`, sourceSection: section, sequence: section.sequence, rows, metadata: { modelId: request.model.id } });
        });
        const document = new ExerciseNotationDocument({ id: identity(request), request, sections, metadata: { pluginId: String(strategy.pluginId), strategyId: String(strategy.id) } });
        if (document.request !== request || document.model !== request.model || document.metadata.pluginId !== String(strategy.pluginId) || document.metadata.strategyId !== String(strategy.id)) throw new ValidationError("Exercise notation document metadata contract mismatch.");
        return document;
    }
}
