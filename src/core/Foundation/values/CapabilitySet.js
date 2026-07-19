import { ImmutableValue } from "./ImmutableValue.js";import{Identifier}from"./Identifier.js";
export class CapabilitySet extends ImmutableValue{constructor(v=[]){if(v instanceof CapabilitySet)return v;const m=new Map;for(const x of v){const id=Identifier.from(typeof x==="string"?x:x.id);m.set(String(id),{id,parameters:typeof x==="string"?{}:x.parameters??{}})}super({values:[...m.values()]})}static from(v){return v instanceof CapabilitySet?v:new CapabilitySet(v??[])}}
export default CapabilitySet;
