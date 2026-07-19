import{ArchitecturalDescriptor}from"../base/index.js";import{CapabilitySet,ReferenceSet}from"../../values/index.js";export class PluginDescriptor extends ArchitecturalDescriptor{constructor(d={}){super(d,{finalize:false});this._defineDescriptorProperties({capabilities: CapabilitySet.from(d.capabilities),
      services: ReferenceSet.from(d.services),
      extensionPoints: ReferenceSet.from(d.extensionPoints)});this._finalizeDescriptor()}get descriptorType(){return"plugin"}}export default PluginDescriptor;
