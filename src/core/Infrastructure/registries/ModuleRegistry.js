import { Registry } from "./Registry.js";

export class ModuleRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "module-registry",
            acceptedDescriptorTypes: ["module"],
            ...options
        });
    }
}

export default ModuleRegistry;
