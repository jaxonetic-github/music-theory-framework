import { ImmutableValue } from "./ImmutableValue.js";
const ALLOWED=Object.freeze(["required", "optional", "peer", "development", "runtime", "conflict"]);
export class DependencyKind extends ImmutableValue{constructor(v="required"){if(v instanceof DependencyKind)return v;v=String(v??"").trim().toLowerCase();if(!ALLOWED.includes(v))throw new TypeError(`Invalid DependencyKind: "${v}".`);super({value:v})}static from(v){return v instanceof DependencyKind?v:new DependencyKind(v)}toString(){return this.value}toJSON(){return this.value}}
export default DependencyKind;
