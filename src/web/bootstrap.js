import {
    ApplicationModule,
    chordMemberRoles,
    ExerciseApplicationModule,
    ExerciseModule,
    ExerciseNotationModule,
    ExportModule,
    Kernel,
    NotationModule,
    PlaybackModule,
    RenderingModule,
    TheoryModule
} from "../core/index.js";
import { WebAudioPlaybackModule } from "./audio/index.js";
import { PlaybackTransportController, PlaybackTransportModule } from "./transport/index.js";

const defaultModules = () => {
    const audio = new WebAudioPlaybackModule();
    const controllerFactory = () => new PlaybackTransportController({ adapter: audio.adapter });
    const transport = new PlaybackTransportModule({
        controller: controllerFactory(), controllerFactory, ownsController: true
    });
    return [
        new TheoryModule(),
        new NotationModule(),
        new RenderingModule(),
        new ExerciseModule(),
        new ExerciseNotationModule(),
        new ExerciseApplicationModule(),
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
        ...(chordMembers ? { memberRoles: chordMemberRoles(pattern) } : {})
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

export async function createWebApplication({
    kernel = new Kernel({ name: "react-web-application" }),
    modules = defaultModules()
} = {}) {
    let disposed = false;
    try {
        for (const module of modules) kernel.use(module);
        await kernel.start();
        const application = kernel.services.resolve("application.engine");
        const exerciseApplication = kernel.services.resolve("exercise.application.engine");
        const playback = kernel.services.resolve("playback.engine");
        const transport = kernel.services.resolve("web.playback.transport");
        const progressionCatalog = kernel.services.resolve("exercise.progressionCatalog");
        const catalogs = Object.freeze({
            scales: catalogOptions(kernel.services.resolve("theory.scaleCatalog")),
            chords: catalogOptions(kernel.services.resolve("theory.chordCatalog"), { chordMembers: true }),
            progressions: progressionOptions(progressionCatalog)
        });
        return Object.freeze({
            application,
            exerciseApplication,
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
