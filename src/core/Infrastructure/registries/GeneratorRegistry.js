import { Registry } from "./Registry.js";

export class GeneratorRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "generator-registry",
            acceptedDescriptorTypes: ["generator"],
            ...options
        });
    }
}

export default GeneratorRegistry;
