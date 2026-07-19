import { ImmutableValue } from "./ImmutableValue.js";
const ALLOWED=Object.freeze(["model", "value", "factory", "registry", "catalog", "strategy", "provider", "service"]);
export class ArchitectureRole extends ImmutableValue{constructor(v="model"){if(v instanceof ArchitectureRole)return v;v=String(v??"").trim().toLowerCase();if(!ALLOWED.includes(v))throw new TypeError(`Invalid ArchitectureRole: "${v}".`);super({value:v})}static from(v){return v instanceof ArchitectureRole?v:new ArchitectureRole(v)}toString(){return this.value}toJSON(){return this.value}}
export default ArchitectureRole;
