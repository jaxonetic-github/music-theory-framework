import { Registry } from "./Registry.js";

export class ThemeRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "theme-registry",
            acceptedDescriptorTypes: ["theme"],
            ...options
        });
    }
}

export default ThemeRegistry;
