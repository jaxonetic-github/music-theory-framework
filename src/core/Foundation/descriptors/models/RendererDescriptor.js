import{ArchitecturalDescriptor}from"../base/index.js";import{CapabilitySet,ReferenceSet}from"../../values/index.js";export class RendererDescriptor extends ArchitecturalDescriptor{constructor(d={}){super(d,{finalize:false});this._defineDescriptorProperties({formats: CapabilitySet.from(d.formats),
      inputTypes: ReferenceSet.from(d.inputTypes),
      outputTypes: ReferenceSet.from(d.outputTypes)});this._finalizeDescriptor()}get descriptorType(){return"renderer"}}export default RendererDescriptor;
