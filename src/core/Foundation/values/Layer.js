import { ImmutableValue } from "./ImmutableValue.js";
export class Layer extends ImmutableValue{constructor(v="foundation"){if(v instanceof Layer)return v;v=String(v??"").trim().toLowerCase();if(!v)throw new TypeError("Layer must not be empty.");super({value:v})}static from(v){return v instanceof Layer?v:new Layer(v)}toString(){return this.value}toJSON(){return this.value}}
export default Layer;
