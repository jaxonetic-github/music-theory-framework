import { Registry } from "./Registry.js";

export class ExerciseRegistry extends Registry {
    constructor(options = {}) {
        super({ name: "exercise-registry", acceptedDescriptorTypes: ["exercise"], ...options });
    }
}

export default ExerciseRegistry;
