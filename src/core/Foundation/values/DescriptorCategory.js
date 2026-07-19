import { ImmutableValue } from "./ImmutableValue.js";
const ALLOWED=Object.freeze(["foundation", "domain", "infrastructure", "application", "plugin"]);
export class DescriptorCategory extends ImmutableValue{constructor(v="foundation"){if(v instanceof DescriptorCategory)return v;v=String(v??"").trim().toLowerCase();if(!ALLOWED.includes(v))throw new TypeError(`Invalid DescriptorCategory: "${v}".`);super({value:v})}static from(v){return v instanceof DescriptorCategory?v:new DescriptorCategory(v)}toString(){return this.value}toJSON(){return this.value}}
export default DescriptorCategory;
