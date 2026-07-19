import { WebAudioPlaybackAdapter } from "./WebAudioPlaybackAdapter.js";
import { webAudioPluginDescriptor, webAudioServiceDescriptor } from "./descriptors.js";
import { webAudioPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); } catch (error) { errors.push(error); }
    }
    return errors;
}

export class WebAudioPlaybackModule {
    #configured = false;
    #undo = [];
    #adapter;
    #adapterFactory;
    #ownsAdapter;
    #adapterDisposed = false;
    #plugin;

    constructor(options = {}) {
        this.id = String(webAudioPackageDescriptor.id);
        this.descriptor = webAudioPackageDescriptor;
        if (options.adapterFactory !== undefined && typeof options.adapterFactory !== "function") {
            throw new TypeError("Web Audio module adapterFactory must be a function.");
        }
        this.#ownsAdapter = options.ownsAdapter ?? options.adapter === undefined;
        this.#adapterFactory = options.adapterFactory ?? (() => new WebAudioPlaybackAdapter(options.adapterOptions));
        if (options.adapter !== undefined && this.#ownsAdapter && options.adapterFactory === undefined) {
            throw new TypeError("An owned injected Web Audio adapter requires an adapterFactory for reusable configuration.");
        }
        this.#setAdapter(options.adapter ?? this.#createAdapter());
        Object.seal(this);
    }

    get adapter() { return this.#adapter; }
    get plugin() { return this.#plugin; }

    configure({ services, registries }) {
        if (this.#configured) return this;
        if (this.#adapterDisposed) this.#setAdapter(this.#createAdapter());
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
            registerService("web.audio.playback", this.adapter);
            registerValue(registries.services, webAudioServiceDescriptor, this.adapter);
            registerValue(registries.plugins, webAudioPluginDescriptor, this.plugin);
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollback = runUndo(undo);
            if (rollback.length) throw new AggregateError([error, ...rollback], "WebAudioPlaybackModule configuration and rollback failed.", { cause: error });
            throw error;
        }
    }

    async dispose() {
        const undo = this.#undo;
        this.#undo = [];
        this.#configured = false;
        const errors = runUndo(undo);
        if (this.#ownsAdapter && !this.#adapterDisposed) {
            try { await this.#adapter.dispose(); } catch (error) { errors.push(error); }
            this.#adapterDisposed = true;
        }
        if (errors.length) throw new AggregateError(errors, "WebAudioPlaybackModule disposal failed.");
        return this;
    }

    #createAdapter() {
        const adapter = this.#adapterFactory();
        if (!adapter || typeof adapter.play !== "function" || typeof adapter.dispose !== "function") {
            throw new TypeError("Web Audio module adapterFactory must return a playback adapter.");
        }
        return adapter;
    }

    #setAdapter(adapter) {
        if (!adapter || typeof adapter.play !== "function" || typeof adapter.dispose !== "function") {
            throw new TypeError("Web Audio module adapter must implement play() and dispose().");
        }
        this.#adapter = adapter;
        this.#plugin = Object.freeze({ id: String(webAudioPluginDescriptor.id), adapter });
        this.#adapterDisposed = false;
    }
}

export default WebAudioPlaybackModule;
