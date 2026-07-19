import{ArchitecturalDescriptor}from"../base/index.js";import{CapabilitySet,ReferenceSet}from"../../values/index.js";export class WorkspaceDescriptor extends ArchitecturalDescriptor{constructor(d={}){super(d,{finalize:false});this._defineDescriptorProperties({capabilities: CapabilitySet.from(d.capabilities),
      providers: ReferenceSet.from(d.providers),
      plugins: ReferenceSet.from(d.plugins)});this._finalizeDescriptor()}get descriptorType(){return"workspace"}}export default WorkspaceDescriptor;
