import { Registry } from "./Registry.js";

export class RendererRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "renderer-registry",
            acceptedDescriptorTypes: ["renderer"],
            ...options
        });
    }
}

export default RendererRegistry;
