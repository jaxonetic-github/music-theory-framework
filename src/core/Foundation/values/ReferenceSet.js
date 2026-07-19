import { ImmutableValue } from "./ImmutableValue.js";import{Reference}from"./Reference.js";
export class ReferenceSet extends ImmutableValue{constructor(v=[]){if(v instanceof ReferenceSet)return v;const m=new Map;for(const x of v){const r=Reference.from(x);m.set(r.toString(),r)}super({values:[...m.values()]})}static from(v){return v instanceof ReferenceSet?v:new ReferenceSet(v??[])}[Symbol.iterator](){return this.values[Symbol.iterator]()}}
export default ReferenceSet;
