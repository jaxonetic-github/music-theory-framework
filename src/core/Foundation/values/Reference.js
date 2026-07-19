import { ImmutableValue } from "./ImmutableValue.js";import{Identifier}from"./Identifier.js";import{ReferenceKind}from"./ReferenceKind.js";
export class Reference extends ImmutableValue{constructor(d){if(d instanceof Reference)return d;const s=typeof d==="string"?{id:d}:d??{};super({id:Identifier.from(s.id),kind:ReferenceKind.from(s.kind??"module")})}static from(v){return v instanceof Reference?v:new Reference(v)}toString(){return String(this.id)}}
export default Reference;
