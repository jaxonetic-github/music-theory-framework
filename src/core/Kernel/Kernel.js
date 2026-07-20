import { ValidationError } from "../Foundation/index.js";
import {
    PackageRegistry, ModuleRegistry, ServiceRegistry, PluginRegistry, ThemeRegistry,
    GeneratorRegistry, RendererRegistry, ExporterRegistry, PlaybackRegistry, ExerciseRegistry, WorkspaceRegistry
} from "../Infrastructure/index.js";
import { CommandBus } from "./CommandBus.js";
import { EventBus } from "./EventBus.js";
import { KernelContext } from "./KernelContext.js";
import { LifecycleState } from "./LifecycleState.js";
import { ServiceContainer } from "./ServiceContainer.js";
import { KernelError } from "./errors/index.js";

const registryFactories = Object.freeze({
    packages: PackageRegistry, modules: ModuleRegistry, services: ServiceRegistry, plugins: PluginRegistry,
    themes: ThemeRegistry, generators: GeneratorRegistry, renderers: RendererRegistry,
    exporters: ExporterRegistry, playbacks: PlaybackRegistry, exercises: ExerciseRegistry, workspaces: WorkspaceRegistry
});

export class Kernel {
    #state = LifecycleState.CREATED;
    #modules = [];
    #configured = [];
    #started = [];

    constructor(options = {}) {
        this.name = String(options.name ?? "kernel");
        this.events = options.events ?? new EventBus();
        this.commands = options.commands ?? new CommandBus();
        this.services = options.services ?? new ServiceContainer();
        this.registries = Object.freeze(Object.fromEntries(Object.entries(registryFactories).map(([name, RegistryType]) => [
            name, options.registries?.[name] ?? new RegistryType()
        ])));
        this.context = new KernelContext({ kernel: this, registries: this.registries, services: this.services, events: this.events, commands: this.commands });
        Object.seal(this);
    }

    get state() { return this.#state; }
    get modules() { return Object.freeze(this.#modules.map(entry => entry.module)); }

    use(module) {
        if (![LifecycleState.CREATED, LifecycleState.CONFIGURED, LifecycleState.STOPPED].includes(this.#state)) {
            throw new KernelError(`Cannot add modules while kernel is ${this.#state}.`);
        }
        if (!module || typeof module !== "object") throw new ValidationError("A kernel module must be an object.");
        const id = String(module.id ?? module.descriptor?.id ?? "");
        if (!id) throw new ValidationError("A kernel module must expose an id or descriptor.id.");
        if (this.#modules.some(entry => entry.id === id)) throw new ValidationError(`Kernel module "${id}" is already installed.`);
        if (module.descriptor) this.#registryFor(module.descriptor)?.register(module.descriptor, { value: module });
        this.#modules.push({ id, module });
        if (this.#state === LifecycleState.CONFIGURED) this.#state = LifecycleState.CREATED;
        return this;
    }

    async configure() {
        if (this.#state === LifecycleState.CONFIGURED) return this;
        this.#requireState([LifecycleState.CREATED, LifecycleState.STOPPED], "configure");
        this.#state = LifecycleState.CONFIGURING;
        try {
            for (const entry of this.#modules) {
                if (!this.#configured.includes(entry)) {
                    if (typeof entry.module.configure === "function") await entry.module.configure(this.context);
                    this.#configured.push(entry);
                }
            }
            this.#state = LifecycleState.CONFIGURED;
            await this.events.publish("kernel.configured", { kernel: this }, { source: this.name });
            return this;
        } catch (cause) {
            this.#state = LifecycleState.FAILED;
            throw new KernelError(`Failed to configure kernel "${this.name}".`, { cause, details: { phase: "configure" } });
        }
    }

    async start() {
        if (this.#state === LifecycleState.RUNNING) return this;
        if ([LifecycleState.CREATED, LifecycleState.STOPPED].includes(this.#state)) await this.configure();
        this.#requireState([LifecycleState.CONFIGURED], "start");
        this.#state = LifecycleState.STARTING;
        try {
            for (const entry of this.#modules) {
                if (typeof entry.module.start === "function") await entry.module.start(this.context);
                this.#started.push(entry);
            }
            this.#state = LifecycleState.RUNNING;
            await this.events.publish("kernel.started", { kernel: this }, { source: this.name });
            return this;
        } catch (cause) {
            await this.#stopStarted();
            this.#state = LifecycleState.FAILED;
            throw new KernelError(`Failed to start kernel "${this.name}".`, { cause, details: { phase: "start" } });
        }
    }

    async stop() {
        if ([LifecycleState.CREATED, LifecycleState.CONFIGURED, LifecycleState.STOPPED].includes(this.#state)) {
            this.#state = LifecycleState.STOPPED;
            return this;
        }
        this.#requireState([LifecycleState.RUNNING, LifecycleState.FAILED], "stop");
        this.#state = LifecycleState.STOPPING;
        const errors = await this.#stopStarted();
        this.#state = LifecycleState.STOPPED;
        await this.events.publish("kernel.stopped", { kernel: this, errors }, { source: this.name });
        if (errors.length) throw new AggregateError(errors, `Failed to stop one or more modules in kernel "${this.name}".`);
        return this;
    }

    async dispose() {
        if (this.#state === LifecycleState.DISPOSED) return;
        if ([LifecycleState.RUNNING, LifecycleState.FAILED].includes(this.#state)) await this.stop();
        const errors = [];
        for (const entry of [...this.#configured].reverse()) {
            try { if (typeof entry.module.dispose === "function") await entry.module.dispose(this.context); }
            catch (error) { errors.push(error); }
        }
        this.#configured = [];
        this.#modules = [];
        this.commands.clear();
        this.events.clear();
        this.services.clear();
        for (const registry of Object.values(this.registries)) registry.clear();
        this.#state = LifecycleState.DISPOSED;
        if (errors.length) throw new AggregateError(errors, `Failed to dispose one or more modules in kernel "${this.name}".`);
    }

    #requireState(states, operation) {
        if (!states.includes(this.#state)) throw new KernelError(`Cannot ${operation} kernel while it is ${this.#state}.`);
    }

    #registryFor(descriptor) {
        const name = `${descriptor.descriptorType}s`;
        return this.registries[name] ?? null;
    }

    async #stopStarted() {
        const errors = [];
        for (const entry of [...this.#started].reverse()) {
            try { if (typeof entry.module.stop === "function") await entry.module.stop(this.context); }
            catch (error) { errors.push(error); }
        }
        this.#started = [];
        return errors;
    }
}

export default Kernel;
