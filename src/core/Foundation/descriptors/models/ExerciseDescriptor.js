import { ArchitecturalDescriptor } from "../base/index.js";
import { CapabilitySet, Reference, ReferenceSet } from "../../values/index.js";

export class ExerciseDescriptor extends ArchitecturalDescriptor {
    constructor(data = {}) {
        super(data, { finalize: false });
        this._defineDescriptorProperties({
            capabilities: CapabilitySet.from(data.capabilities),
            plugin: Reference.from(data.plugin),
            inputTypes: ReferenceSet.from(data.inputTypes),
            outputTypes: ReferenceSet.from(data.outputTypes)
        });
        this._finalizeDescriptor();
    }

    get descriptorType() { return "exercise"; }
}

export default ExerciseDescriptor;
