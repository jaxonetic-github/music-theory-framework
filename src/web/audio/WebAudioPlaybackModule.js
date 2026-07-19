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

    constructor(options = {}) {
        this.id = String(webAudioPackageDescriptor.id);
        this.descriptor = webAudioPackageDescriptor;
        this.adapter = options.adapter ?? new WebAudioPlaybackAdapter(options.adapterOptions);
        this.plugin = Object.freeze({ id: String(webAudioPluginDescriptor.id), adapter: this.adapter });
        Object.seal(this);
    }

    configure({ services, registries }) {
        if (this.#configured) return this;
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
        try { await this.adapter.dispose(); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "WebAudioPlaybackModule disposal failed.");
        return this;
    }
}

export default WebAudioPlaybackModule;
