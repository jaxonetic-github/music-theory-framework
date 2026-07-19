import { ImmutableValue } from "./ImmutableValue.js";
export class Description extends ImmutableValue{constructor(v=""){if(v instanceof Description)return v;super({value:String(v??"").trim()})}static from(v){return v instanceof Description?v:new Description(v)}toString(){return this.value}}
export default Description;
