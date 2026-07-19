import{ArchitecturalDescriptor}from"../base/index.js";import{CapabilitySet,ReferenceSet}from"../../values/index.js";export class PackageDescriptor extends ArchitecturalDescriptor{constructor(d={}){super(d,{finalize:false});this._defineDescriptorProperties({capabilities: CapabilitySet.from(d.capabilities),
      owns: ReferenceSet.from(d.owns),
      consumes: ReferenceSet.from(d.consumes),
      provides: ReferenceSet.from(d.provides),
      publicApi: ReferenceSet.from(d.publicApi)});this._finalizeDescriptor()}get descriptorType(){return"package"}}export default PackageDescriptor;
