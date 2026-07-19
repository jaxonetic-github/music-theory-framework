import { ImmutableValue } from "./ImmutableValue.js";
const ALLOWED=Object.freeze(["experimental", "alpha", "beta", "stable", "deprecated", "internal"]);
export class Stability extends ImmutableValue{constructor(v="experimental"){if(v instanceof Stability)return v;v=String(v??"").trim().toLowerCase();if(!ALLOWED.includes(v))throw new TypeError(`Invalid Stability: "${v}".`);super({value:v})}static from(v){return v instanceof Stability?v:new Stability(v)}toString(){return this.value}toJSON(){return this.value}}
export default Stability;
