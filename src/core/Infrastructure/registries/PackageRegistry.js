import { Registry } from "./Registry.js";

export class PackageRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "package-registry",
            acceptedDescriptorTypes: ["package"],
            ...options
        });
    }
}

export default PackageRegistry;
