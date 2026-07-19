import { ImmutableValue } from "./ImmutableValue.js";
export class Metadata extends ImmutableValue{constructor(d={}){if(d instanceof Metadata)return d;super({tags:[...new Set((d.tags??[]).map(String))],annotations:d.annotations??{},attributes:d.attributes??{},documentation:d.documentation??null})}static from(v){return v instanceof Metadata?v:new Metadata(v??{})}}
export default Metadata;
