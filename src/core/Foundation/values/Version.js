import { ImmutableValue } from "./ImmutableValue.js";
const R=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
export class Version extends ImmutableValue{constructor(v="0.0.0"){if(v instanceof Version)return v;const m=R.exec(String(v).trim());if(!m)throw new TypeError(`Invalid semantic version: "${v}".`);super({major:+m[1],minor:+m[2],patch:+m[3],prerelease:m[4]??null,build:m[5]??null})}static from(v){return v instanceof Version?v:new Version(v??"0.0.0")}toString(){return `${this.major}.${this.minor}.${this.patch}${this.prerelease?`-${this.prerelease}`:""}${this.build?`+${this.build}`:""}`}toJSON(){return this.toString()}}
export default Version;
