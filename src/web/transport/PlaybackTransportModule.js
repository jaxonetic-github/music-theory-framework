import { PlaybackTransportController } from "./PlaybackTransportController.js";
import { playbackTransportPluginDescriptor, playbackTransportServiceDescriptor } from "./descriptors.js";
import { playbackTransportPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) { try { undo(); } catch (error) { errors.push(error); } }
    return errors;
}

function controllerContract(controller) {
    if (!controller || typeof controller.load !== "function" || typeof controller.play !== "function" || typeof controller.dispose !== "function") {
        throw new TypeError("Playback transport module requires a transport controller.");
    }
    return controller;
}

export class PlaybackTransportModule {
    #configured = false;
    #undo = [];
    #controller;
    #controllerFactory;
    #ownsController;
    #controllerDisposed = false;
    #plugin;

    constructor(options = {}) {
        this.id = String(playbackTransportPackageDescriptor.id);
        this.descriptor = playbackTransportPackageDescriptor;
        if (options.controllerFactory !== undefined && typeof options.controllerFactory !== "function") throw new TypeError("Playback transport controllerFactory must be a function.");
        this.#ownsController = options.ownsController ?? options.controller === undefined;
        this.#controllerFactory = options.controllerFactory ?? (() => new PlaybackTransportController(options.controllerOptions));
        if (options.controller !== undefined && this.#ownsController && options.controllerFactory === undefined) {
            throw new TypeError("An owned injected transport requires a controllerFactory for reusable configuration.");
        }
        this.#setController(options.controller ?? this.#createController());
        Object.seal(this);
    }

    get controller() { return this.#controller; }
    get plugin() { return this.#plugin; }

    configure({ services, registries }) {
        if (this.#configured) return this;
        if (this.#controllerDisposed) this.#setController(this.#createController());
        const undo = [];
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => { if (services.resolve(id, { optional: true }) === value) services.unregister(id); });
        };
        const registerValue = (registry, descriptor, value) => {
            const previous = registry.getRecord(descriptor.id);
            let record = null;
            const unregister = current => { if (registry.getRecord(descriptor.id) === current) registry.unregister(descriptor.id); };
            try { record = registry.register(descriptor, { value }); }
            catch (error) {
                const current = registry.getRecord(descriptor.id);
                if (!previous && current?.descriptor === descriptor && current?.value === value) {
                    try { unregister(current); } catch {}
                }
                throw error;
            }
            undo.push(() => unregister(record));
        };
        try {
            registerService("web.playback.transport", this.#controller);
            registerValue(registries.services, playbackTransportServiceDescriptor, this.#controller);
            registerValue(registries.plugins, playbackTransportPluginDescriptor, this.#plugin);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollback = runUndo(undo);
            if (rollback.length) throw new AggregateError([error, ...rollback], "PlaybackTransportModule configuration and rollback failed.", { cause: error });
            throw error;
        }
    }

    async dispose() {
        const undo = this.#undo;
        this.#undo = [];
        this.#configured = false;
        const errors = runUndo(undo);
        if (this.#ownsController && !this.#controllerDisposed) {
            try { await this.#controller.dispose(); } catch (error) { errors.push(error); }
            this.#controllerDisposed = true;
        }
        if (errors.length) throw new AggregateError(errors, "PlaybackTransportModule disposal failed.");
        return this;
    }

    #createController() { return controllerContract(this.#controllerFactory()); }
    #setController(controller) {
        this.#controller = controllerContract(controller);
        this.#plugin = Object.freeze({ id: String(playbackTransportPluginDescriptor.id), controller });
        this.#controllerDisposed = false;
    }
}

export default PlaybackTransportModule;
