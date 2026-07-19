import { Registry } from "./Registry.js";

export class PlaybackRegistry extends Registry {
    constructor(options = {}) {
        super({
            name: "playback-registry",
            acceptedDescriptorTypes: ["playback"],
            ...options
        });
    }
}

export default PlaybackRegistry;
