import { Registry } from "./Registry.js";

export class ExporterRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "exporter-registry",
            acceptedDescriptorTypes: ["exporter"],
            ...options
        });
    }
}

export default ExporterRegistry;
