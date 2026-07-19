export class KernelContext {
    constructor({ kernel, registries, services, events, commands }) {
        Object.defineProperties(this, {
            kernel: { value: kernel, enumerable: true },
            registries: { value: registries, enumerable: true },
            services: { value: services, enumerable: true },
            events: { value: events, enumerable: true },
            commands: { value: commands, enumerable: true }
        });
        Object.freeze(this);
    }

    resolve(id, options) { return this.services.resolve(id, options); }
    publish(type, payload, options) { return this.events.publish(type, payload, options); }
    execute(type, payload, context) { return this.commands.execute(type, payload, context); }
}

export default KernelContext;
