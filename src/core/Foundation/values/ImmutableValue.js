import { freezeDeep,cloneDeep,equalsDeep } from "../utilities/index.js";
export class ImmutableValue{constructor(props={}){for(const[k,v]of Object.entries(props))Object.defineProperty(this,k,{value:freezeDeep(cloneDeep(v)),enumerable:true});Object.freeze(this)}equals(o){return o instanceof this.constructor&&equalsDeep(this,o)}toObject(){return Object.fromEntries(Object.keys(this).map(k=>[k,cloneDeep(this[k])]))}toJSON(){return this.toObject()}}
export default ImmutableValue;
