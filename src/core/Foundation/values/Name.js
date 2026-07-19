import { ImmutableValue } from "./ImmutableValue.js";
export class Name extends ImmutableValue{constructor(d){if(d instanceof Name)return d;const s=typeof d==="string"?{value:d}:d??{};const value=String(s.value??s.displayName??"").trim();if(!value)throw new TypeError("Name.value must not be empty.");super({value,displayName:String(s.displayName??value).trim(),aliases:[...new Set((s.aliases??[]).map(x=>String(x).trim()).filter(Boolean))]})}static from(v){return v instanceof Name?v:new Name(v)}toString(){return this.displayName}}
export default Name;
