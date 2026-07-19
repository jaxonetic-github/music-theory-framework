import { ImmutableValue } from "./ImmutableValue.js";
const P=/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
export class Identifier extends ImmutableValue{constructor(v){if(v instanceof Identifier)return v;v=String(v??"").trim();if(!P.test(v))throw new TypeError(`Invalid identifier: "${v}".`);super({value:v})}static from(v){return v instanceof Identifier?v:new Identifier(v)}toString(){return this.value}toJSON(){return this.value}}
export default Identifier;
