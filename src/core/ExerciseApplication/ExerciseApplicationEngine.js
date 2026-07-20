import { ValidationError } from "../Foundation/index.js";
import { ExerciseModel } from "../Exercise/index.js";
import { ExerciseNotationDocument } from "../ExerciseNotation/index.js";
import { ExerciseApplicationRequest } from "./ExerciseApplicationRequest.js";
import { ExerciseApplicationResult } from "./ExerciseApplicationResult.js";
import { ExerciseApplicationWorkflowError } from "./ExerciseApplicationWorkflowError.js";
import { ExercisePresentationDocument } from "./ExercisePresentationDocument.js";
import { ExercisePresentationRow } from "./ExercisePresentationRow.js";
import { ExercisePresentationSection } from "./ExercisePresentationSection.js";
import { ExercisePresentationSystem } from "./ExercisePresentationSystem.js";

const mediaTypes = Object.freeze({ svg: "image/svg+xml", html: "text/html", text: "text/plain", json: "application/json" });
function service(value, method, label) { if (!value || typeof value[method] !== "function") throw new ValidationError(`${label} must implement ${method}().`); return value; }
function selectionOptions(request) { return { ...request.options, format: request.format, ...(request.pluginId ? { pluginId: request.pluginId } : {}), ...(request.strategyId ? { strategyId: request.strategyId } : {}) }; }

export class ExerciseApplicationEngine {
    constructor({ exerciseEngine, notationEngine, renderingEngine } = {}) {
        this.exerciseEngine = service(exerciseEngine, "generate", "ExerciseApplicationEngine exerciseEngine");
        this.notationEngine = service(notationEngine, "notate", "ExerciseApplicationEngine notationEngine");
        this.renderingEngine = service(renderingEngine, "render", "ExerciseApplicationEngine renderingEngine");
        if (!renderingEngine.registry || typeof renderingEngine.registry.select !== "function") throw new ValidationError("ExerciseApplicationEngine renderingEngine requires its active renderer strategy registry.");
        Object.freeze(this);
    }

    run(input) {
        const request = ExerciseApplicationRequest.from(input);
        const model = request.model ?? this.#stage("generation", null, () => this.exerciseEngine.generate(request.exercise));
        if (!(model instanceof ExerciseModel)) throw new ExerciseApplicationWorkflowError("generation", new ValidationError("Exercise engine did not return an ExerciseModel."));
        if (request.model === null && model.request !== request.exercise) throw new ExerciseApplicationWorkflowError("generation", new ValidationError("Exercise engine returned a model for a different request."));
        const notationOptions = { duration: request.notation.duration, clef: request.notation.clef, timeSignature: request.notation.timeSignature, measuresPerSystem: request.notation.measuresPerSystem, keySignaturePolicy: request.notation.keySignaturePolicy, ...(request.notation.keySignature ? { keySignature: request.notation.keySignature } : {}), ...(request.notation.pluginId ? { pluginId: request.notation.pluginId } : {}), ...(request.notation.strategyId ? { strategyId: request.notation.strategyId } : {}) };
        let notationDocument;
        try { notationDocument = this.notationEngine.notate(model, notationOptions); }
        catch (cause) { const row = model.rows.find(value => String(cause?.message ?? "").includes(String(value.id))); throw new ExerciseApplicationWorkflowError("notation", cause, row?.id ?? null); }
        if (!(notationDocument instanceof ExerciseNotationDocument) || notationDocument.model !== model) throw new ExerciseApplicationWorkflowError("notation", new ValidationError("Exercise notation engine returned an incompatible document."));
        if (notationDocument.sections.length !== model.sections.length || notationDocument.sections.some((section, index) => section.sourceSection !== model.sections[index])) throw new ExerciseApplicationWorkflowError("notation", new ValidationError("Exercise notation document does not preserve model section order and identity."));

        const renderOptions = selectionOptions(request.rendering); let rowSequence = 0; const rendererIdentities = new Set();
        const sections = notationDocument.sections.map(notationSection => {
            const rows = notationSection.rows.map(notationRow => {
                rowSequence += 1; const rowId = String(notationRow.sourceRow.id);
                return this.#stage("rendering", rowId, () => {
                    if (notationRow.sourceRow !== notationSection.sourceSection.rows[notationSection.rows.indexOf(notationRow)]) throw new ValidationError("Notation row does not preserve source row order and identity.");
                    const strategy = this.renderingEngine.registry.select(notationRow.graph, renderOptions);
                    if (!strategy) throw new ValidationError(`No renderer strategy supports requested format "${request.rendering.format}".`);
                    if (String(strategy.format) !== request.rendering.format) throw new ValidationError(`Selected renderer produces "${strategy.format}", not "${request.rendering.format}".`);
                    if (request.rendering.pluginId && String(strategy.pluginId) !== request.rendering.pluginId) throw new ValidationError("Selected renderer plugin identity does not match the workflow request.");
                    if (request.rendering.strategyId && String(strategy.id) !== request.rendering.strategyId) throw new ValidationError("Selected renderer strategy identity does not match the workflow request.");
                    const content = this.renderingEngine.render(notationRow.graph, renderOptions);
                    if (typeof content !== "string" || !content.trim()) throw new ValidationError("Rendering engine returned inconsistent renderer output.");
                    if (this.renderingEngine.registry.select(notationRow.graph, renderOptions) !== strategy) throw new ValidationError("Rendering engine selection changed while producing a row.");
                    const pluginId = String(strategy.pluginId), strategyId = String(strategy.id), format = String(strategy.format); rendererIdentities.add(`${pluginId}:${strategyId}:${format}`);
                    const systems = notationRow.systems.map(system => new ExercisePresentationSystem({ id: `${system.id}:presentation`, sourceSystem: system, sequence: system.sequence, measureIds: system.measureIds, metadata: { notationSystemId: system.id } }));
                    return new ExercisePresentationRow({ id: `${notationRow.id}:presentation:${format}:${pluginId}:${strategyId}`, modelId: model.id, sectionId: notationSection.sourceSection.id, sourceRow: notationRow.sourceRow, notationRow, graph: notationRow.graph, systems, content, format, mediaType: mediaTypes[format] ?? `application/${format}`, rendererPluginId: pluginId, rendererStrategyId: strategyId, sequence: rowSequence, metadata: { modelId: model.id, sectionId: notationSection.sourceSection.id, exerciseRowId: notationRow.sourceRow.id, notationRowId: notationRow.id, renderer: { pluginId, strategyId, format } } });
                });
            });
            return new ExercisePresentationSection({ id: `${notationSection.id}:presentation`, sourceSection: notationSection.sourceSection, notationSection, sequence: notationSection.sequence, rows, metadata: { modelId: model.id, notationSectionId: notationSection.id } });
        });
        const renderer = [...rendererIdentities]; if (renderer.length !== 1) throw new ExerciseApplicationWorkflowError("rendering", new ValidationError("Exercise presentation rows used inconsistent renderer metadata."));
        const [pluginId, strategyId, format] = renderer[0].split(":");
        const metadata = { workflowId: request.identity, sourceModelId: model.id, notationDocumentId: notationDocument.id, generationBypassed: request.model !== null, rendering: { serviceId: "rendering.engine", pluginId, strategyId, format, mediaType: mediaTypes[format] ?? `application/${format}` } };
        const presentation = new ExercisePresentationDocument({ id: `${request.identity}:document:${notationDocument.id}:${pluginId}:${strategyId}`, request, model, notationDocument, sections, metadata });
        return new ExerciseApplicationResult({ request, model, notationDocument, presentation, metadata: { ...metadata, stages: Object.freeze(["generation", "notation", "rendering", "presentation"]) } });
    }

    #stage(stage, rowId, operation) { try { return operation(); } catch (cause) { if (cause instanceof ExerciseApplicationWorkflowError) throw cause; throw new ExerciseApplicationWorkflowError(stage, cause, rowId); } }
}
export default ExerciseApplicationEngine;
