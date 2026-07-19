import { MusicTheoryApplication } from "./MusicTheoryApplication.js";
import { applicationCommandDescriptors, applicationServiceDescriptors } from "./descriptors.js";
import { applicationPackageDescriptor } from "./package.descriptor.js";

function runUndo(actions) {
    const errors = [];
    for (const undo of [...actions].reverse()) {
        try { undo(); }
        catch (error) { errors.push(error); }
    }
    return errors;
}

export class ApplicationModule {
    #configured = false;
    #services = null;
    #undo = [];

    constructor(options = {}) {
        this.id = String(applicationPackageDescriptor.id);
        this.descriptor = applicationPackageDescriptor;
        this.engine = options.engine ?? new MusicTheoryApplication(id => this.#services?.resolve(id));
        this.workflowHandler = request => this.engine.run(request);
        Object.seal(this);
    }

    configure({ services, registries, commands }) {
        if (this.#configured) return this;
        this.#services = services;
        const undo = [];
        const registerService = (id, value) => {
            services.register(id, value);
            undo.push(() => {
                if (services.resolve(id, { optional: true }) === value) services.unregister(id);
            });
        };
        const registerValue = (registry, descriptor, value) => {
            const previousRecord = registry.getRecord(descriptor.id);
            let registeredRecord = null;
            const unregister = record => {
                if (registry.getRecord(descriptor.id) === record) registry.unregister(descriptor.id);
            };
            try { registeredRecord = registry.register(descriptor, { value }); }
            catch (error) {
                const currentRecord = registry.getRecord(descriptor.id);
                if (!previousRecord
                    && currentRecord?.descriptor === descriptor
                    && currentRecord?.value === value) {
                    try { unregister(currentRecord); } catch {}
                }
                throw error;
            }
            undo.push(() => unregister(registeredRecord));
        };

        try {
            registerService("application.engine", this.engine);
            registerValue(registries.services, applicationServiceDescriptors.engine, this.engine);
            undo.push(commands.register(String(applicationCommandDescriptors.runWorkflow.id), this.workflowHandler));
            this.#undo = undo;
            this.#configured = true;
            return this;
        } catch (error) {
            const rollbackErrors = runUndo(undo);
            this.#services = null;
            if (rollbackErrors.length) {
                throw new AggregateError([error, ...rollbackErrors], "ApplicationModule configuration and rollback failed.", { cause: error });
            }
            throw error;
        }
    }

    dispose() {
        const undo = this.#undo;
        this.#undo = [];
        this.#configured = false;
        const errors = runUndo(undo);
        this.#services = null;
        if (errors.length) throw new AggregateError(errors, "ApplicationModule disposal failed.");
        return this;
    }
}

export default ApplicationModule;
