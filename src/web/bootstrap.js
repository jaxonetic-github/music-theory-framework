import {
    ApplicationModule,
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

function catalogOptions(catalog) {
    return Object.freeze(catalog.values().map(pattern => Object.freeze({
        id: String(pattern.id),
        name: String(pattern.name),
        memberCount: pattern.intervals?.length ?? null
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
        const catalogs = Object.freeze({
            scales: catalogOptions(kernel.services.resolve("theory.scaleCatalog")),
            chords: catalogOptions(kernel.services.resolve("theory.chordCatalog"))
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
