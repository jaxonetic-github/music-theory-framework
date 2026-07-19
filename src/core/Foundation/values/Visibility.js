import { ImmutableValue } from "./ImmutableValue.js";
const ALLOWED=Object.freeze(["public", "internal", "private"]);
export class Visibility extends ImmutableValue{constructor(v="internal"){if(v instanceof Visibility)return v;v=String(v??"").trim().toLowerCase();if(!ALLOWED.includes(v))throw new TypeError(`Invalid Visibility: "${v}".`);super({value:v})}static from(v){return v instanceof Visibility?v:new Visibility(v)}toString(){return this.value}toJSON(){return this.value}}
export default Visibility;
