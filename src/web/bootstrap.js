import {
    ApplicationModule,
    ExportModule,
    Kernel,
    NotationModule,
    RenderingModule,
    TheoryModule
} from "../core/index.js";

const defaultModules = () => [
    new TheoryModule(),
    new NotationModule(),
    new RenderingModule(),
    new ExportModule(),
    new ApplicationModule()
];

function catalogOptions(catalog) {
    return Object.freeze(catalog.values().map(pattern => Object.freeze({
        id: String(pattern.id),
        name: String(pattern.name)
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
        const catalogs = Object.freeze({
            scales: catalogOptions(kernel.services.resolve("theory.scaleCatalog")),
            chords: catalogOptions(kernel.services.resolve("theory.chordCatalog"))
        });
        return Object.freeze({
            application,
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
