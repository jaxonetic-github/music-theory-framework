import {
    ApplicationModule,
    chordMemberRoles,
    CurriculumModule,
    ExerciseApplicationModule,
    ExerciseModule,
    ExerciseNotationModule,
    ExerciseSetModule,
    ExportModule,
    Kernel,
    LayoutModule,
    NotationModule,
    PlaybackModule,
    RenderingModule,
    TheoryModule
} from "../core/index.js";
import { WebAudioPlaybackModule } from "./audio/index.js";
import { PlaybackTransportController, PlaybackTransportModule } from "./transport/index.js";

const defaultModules = () => {
    const layout = new LayoutModule();
    const audio = new WebAudioPlaybackModule();
    const controllerFactory = () => new PlaybackTransportController({ adapter: audio.adapter });
    const transport = new PlaybackTransportModule({
        controller: controllerFactory(), controllerFactory, ownsController: true
    });
    return [
        new TheoryModule(),
        new NotationModule(),
        layout,
        new RenderingModule({ layoutEngine: layout.engine }),
        new ExerciseModule(),
        new ExerciseNotationModule(),
        new ExerciseApplicationModule(),
        new ExerciseSetModule(),
        new CurriculumModule(),
        new ExportModule(),
        new ApplicationModule(),
        new PlaybackModule(),
        audio,
        transport
    ];
};

function catalogOptions(catalog, { chordMembers = false } = {}) {
    return Object.freeze(catalog.values().map(pattern => Object.freeze({
        id: String(pattern.id),
        name: String(pattern.name),
        memberCount: pattern.intervals?.length ?? null,
        ...(chordMembers ? {
            targetCompatible: [3, 4].includes(pattern.intervals?.length),
            ...([3, 4].includes(pattern.intervals?.length) ? { memberRoles: chordMemberRoles(pattern) } : {})
        } : {})
    })));
}

function progressionOptions(catalog) {
    if (!catalog || typeof catalog.values !== "function") throw new TypeError("The Web runtime requires exercise.progressionCatalog.");
    return Object.freeze(catalog.values().map(progression => Object.freeze({
        id: String(progression.id), name: String(progression.name), mode: String(progression.mode),
        events: Object.freeze(progression.events.map(event => Object.freeze({
            position: event.position, romanNumeral: String(event.romanNumeral), function: String(event.function), quality: String(event.quality)
        })))
    })));
}
function curriculumOptions(templateCatalog, curriculumCatalog, catalogs) {
    const choices = source => source === "theory.scaleCatalog" ? catalogs.scales
        : source === "theory.chordCatalog" ? catalogs.chords
        : source === "exercise.progressionCatalog" ? catalogs.progressions
        : source === "exercise.chordMemberRoles"
            ? Object.freeze([...new Set(catalogs.chords.flatMap(value => value.memberRoles ?? []))].sort().map(id => Object.freeze({ id, name: id })))
            : null;
    const templates = Object.freeze(templateCatalog.entries().map(({ pluginId, value }) => Object.freeze({
        id: value.id, pluginId, key: `${pluginId}:${value.id}`, name: value.name, description: value.description,
        family: String(value.family), objective: value.objective, difficulty: String(value.difficulty),
        tags: value.tags, prerequisites: value.prerequisites, version: value.version, instructions: value.instructions,
        constraints: value.constraints,
        parameters: Object.freeze(value.parameters.map(parameter => Object.freeze({
            id: parameter.id, label: parameter.label, contract: parameter.contract, required: parameter.required,
            overridable: parameter.overridable, helpText: parameter.helpText,
            defaultValue: value.constraints[parameter.id] ?? value.defaults[parameter.id] ?? parameter.defaultValue ?? null,
            fixed: Object.hasOwn(value.constraints, parameter.id),
            choices: choices(parameter.validationSource) ?? (parameter.allowedValues?.map(entry => Object.freeze({
                id: typeof entry === "object" ? JSON.stringify(entry) : String(entry),
                name: typeof entry === "object"
                    ? (Object.hasOwn(entry, "numerator") ? `${entry.numerator}/${entry.denominator}` : `${entry.beats}/${entry.beatUnit}`)
                    : String(entry),
                value: entry
            })) ?? null)
        })))
    })));
    const curricula = Object.freeze(curriculumCatalog.entries().map(({ pluginId, value }) => Object.freeze({
        id: value.id, pluginId, key: `${pluginId}:${value.id}`, title: value.title, description: value.description,
        objective: value.objective, difficulty: String(value.difficulty), tags: value.tags,
        prerequisites: value.prerequisites, version: value.version,
        units: Object.freeze(value.units.map(unit => Object.freeze({
            id: unit.id, title: unit.title, objective: unit.objective, difficulty: String(unit.difficulty),
            lessons: Object.freeze(unit.lessons.map(lesson => Object.freeze({
                id: lesson.id, title: lesson.title, objective: lesson.objective, difficulty: String(lesson.difficulty),
                prerequisites: lesson.prerequisites, templateIds: Object.freeze(lesson.templates.map(reference => reference.templateId))
            })))
        })))
    })));
    return Object.freeze({ templates, curricula });
}

export async function createWebApplication({
    kernel = new Kernel({ name: "react-web-application" }),
    modules = defaultModules()
} = {}) {
    let disposed = false;
    try {
        for (const module of modules) kernel.use(module);
        await kernel.start();
        const application = kernel.services.resolve("application.engine");
        const layout = kernel.services.resolve("layout.engine");
        const rendering = kernel.services.resolve("rendering.engine");
        const exerciseApplication = kernel.services.resolve("exercise.application.engine");
        const exerciseSetApplication = kernel.services.resolve("exercise.set.application");
        const playback = kernel.services.resolve("playback.engine");
        const transport = kernel.services.resolve("web.playback.transport");
        const progressionCatalog = kernel.services.resolve("exercise.progressionCatalog");
        const baseCatalogs = {
            scales: catalogOptions(kernel.services.resolve("theory.scaleCatalog")),
            chords: catalogOptions(kernel.services.resolve("theory.chordCatalog"), { chordMembers: true }),
            progressions: progressionOptions(progressionCatalog)
        };
        const curriculumEngine = kernel.services.resolve("curriculum.engine", { optional: true });
        const templateCatalog = kernel.services.resolve("curriculum.template-catalog", { optional: true });
        const curriculumCatalog = kernel.services.resolve("curriculum.catalog", { optional: true });
        const curriculum = curriculumEngine && templateCatalog && curriculumCatalog
            ? curriculumOptions(templateCatalog, curriculumCatalog, baseCatalogs)
            : Object.freeze({ templates: Object.freeze([]), curricula: Object.freeze([]) });
        const catalogs = Object.freeze({ ...baseCatalogs, ...curriculum });
        return Object.freeze({
            application,
            layout,
            rendering,
            exerciseApplication,
            exerciseSetApplication,
            curriculumEngine,
            playback,
            transport,
            catalogs,
            async dispose() {
                if (disposed) return;
                disposed = true;
                await kernel.dispose();
            }
        });
    } catch (cause) {
        try { await kernel.dispose(); }
        catch (disposeError) {
            throw new AggregateError([cause, disposeError], "Web application bootstrap and cleanup failed.", { cause });
        }
        throw cause;
    }
}

export default createWebApplication;
