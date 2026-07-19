import { ValidationError } from "../Foundation/index.js";
import { ApplicationRequest } from "./ApplicationRequest.js";
import { ApplicationResult } from "./ApplicationResult.js";
import { ApplicationWorkflowError } from "./ApplicationWorkflowError.js";
import { RenderingOutput } from "./RenderingOutput.js";

function serviceResolver(resolver) {
    if (typeof resolver === "function") return resolver;
    if (resolver && typeof resolver.resolve === "function") return (id, options) => resolver.resolve(id, options);
    throw new ValidationError("MusicTheoryApplication requires a Kernel service resolver.");
}

function stageOptions(request) {
    return Object.freeze({
        ...request.options,
        ...(request.pluginId ? { pluginId: request.pluginId } : {}),
        ...(request.strategyId ? { strategyId: request.strategyId } : {}),
        format: request.format
    });
}

function selectedStrategy(engine, input, format, options) {
    if (!engine.registry || typeof engine.registry.select !== "function") return null;
    return format === null
        ? engine.registry.select(input, options)
        : engine.registry.select(input, format, options);
}

function strategyMetadata(strategy, request) {
    return Object.freeze({
        pluginId: strategy ? String(strategy.pluginId) : request?.pluginId ?? null,
        strategyId: strategy ? String(strategy.id) : request?.strategyId ?? null
    });
}

export class MusicTheoryApplication {
    #resolve;

    constructor(resolver) {
        this.#resolve = serviceResolver(resolver);
        Object.freeze(this);
    }

    run(input) {
        const request = ApplicationRequest.from(input);
        const generationServiceId = `theory.${request.type}Generator`;
        const generation = this.#stage("generation", () => {
            const generator = this.#resolve(generationServiceId);
            if (!generator || typeof generator.generateResult !== "function") {
                throw new ValidationError(`Service "${generationServiceId}" does not implement generateResult().`);
            }
            return generator.generateResult(request.root, request.selection, request.generationOptions);
        });

        let notationStrategy = null;
        const score = this.#stage("notation", () => {
            const engine = this.#resolve("notation.engine");
            if (!engine || typeof engine.notate !== "function") {
                throw new ValidationError('Service "notation.engine" does not implement notate().');
            }
            const result = engine.notate(generation, request.notationOptions);
            notationStrategy = selectedStrategy(engine, generation, null, request.notationOptions);
            return result;
        });

        let rendering = null;
        let renderingStrategy = null;
        if (request.rendering) {
            rendering = this.#stage("rendering", () => {
                const engine = this.#resolve("rendering.engine");
                if (!engine || typeof engine.render !== "function") {
                    throw new ValidationError('Service "rendering.engine" does not implement render().');
                }
                const options = stageOptions(request.rendering);
                const content = engine.render(score, options);
                renderingStrategy = selectedStrategy(engine, score, null, options);
                if (renderingStrategy?.format && renderingStrategy.format !== request.rendering.format) {
                    throw new ValidationError(`Selected renderer produces "${renderingStrategy.format}", not "${request.rendering.format}".`);
                }
                return new RenderingOutput({ format: request.rendering.format, content });
            });
        }

        let exported = null;
        let exportStrategy = null;
        if (request.export) {
            exported = this.#stage("export", () => {
                const engine = this.#resolve("export.engine");
                if (!engine || typeof engine.export !== "function") {
                    throw new ValidationError('Service "export.engine" does not implement export().');
                }
                const options = stageOptions(request.export);
                const result = engine.export(score, request.export.format, options);
                exportStrategy = selectedStrategy(engine, score, request.export.format, options);
                return result;
            });
        }

        return new ApplicationResult({
            request,
            generation,
            score,
            rendering,
            exported,
            metadata: {
                generation: { serviceId: generationServiceId, generatorId: String(generation.generatorId) },
                notation: { serviceId: "notation.engine", ...strategyMetadata(notationStrategy, request.notationOptions) },
                rendering: request.rendering ? {
                    serviceId: "rendering.engine", format: request.rendering.format,
                    ...strategyMetadata(renderingStrategy, request.rendering)
                } : null,
                export: request.export ? {
                    serviceId: "export.engine", format: request.export.format,
                    ...strategyMetadata(exportStrategy, request.export)
                } : null
            }
        });
    }

    #stage(stage, operation) {
        try { return operation(); }
        catch (cause) { throw new ApplicationWorkflowError(stage, cause); }
    }
}

export default MusicTheoryApplication;
