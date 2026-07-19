import { Registry } from "./Registry.js";

export class WorkspaceRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "workspace-registry",
            acceptedDescriptorTypes: ["workspace"],
            ...options
        });
    }
}

export default WorkspaceRegistry;
