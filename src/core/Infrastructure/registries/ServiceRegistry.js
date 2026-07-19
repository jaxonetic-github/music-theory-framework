import { Registry } from "./Registry.js";

export class ServiceRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "service-registry",
            acceptedDescriptorTypes: ["service"],
            ...options
        });
    }
}

export default ServiceRegistry;
