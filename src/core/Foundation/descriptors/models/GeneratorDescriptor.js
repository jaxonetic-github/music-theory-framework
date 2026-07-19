import{ArchitecturalDescriptor}from"../base/index.js";import{CapabilitySet,ReferenceSet}from"../../values/index.js";export class GeneratorDescriptor extends ArchitecturalDescriptor{constructor(d={}){super(d,{finalize:false});this._defineDescriptorProperties({capabilities: CapabilitySet.from(d.capabilities),
      inputTypes: ReferenceSet.from(d.inputTypes),
      outputTypes: ReferenceSet.from(d.outputTypes)});this._finalizeDescriptor()}get descriptorType(){return"generator"}}export default GeneratorDescriptor;
