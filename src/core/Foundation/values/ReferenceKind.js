import { ImmutableValue } from "./ImmutableValue.js";
const ALLOWED=Object.freeze(["package", "module", "value", "plugin", "service", "generator", "renderer", "exporter", "playback", "command", "event", "workspace"]);
export class ReferenceKind extends ImmutableValue{constructor(v="module"){if(v instanceof ReferenceKind)return v;v=String(v??"").trim().toLowerCase();if(!ALLOWED.includes(v))throw new TypeError(`Invalid ReferenceKind: "${v}".`);super({value:v})}static from(v){return v instanceof ReferenceKind?v:new ReferenceKind(v)}toString(){return this.value}toJSON(){return this.value}}
export default ReferenceKind;
