import { Registry } from "./Registry.js";

export class PluginRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "plugin-registry",
            acceptedDescriptorTypes: ["plugin"],
            ...options
        });
    }
}

export default PluginRegistry;
