import { assertEnum } from "../assertions/index.js";
export function isEnumValue(e,v){assertEnum(e);return Object.values(e).some(x=>Object.is(x,v))}
export function enumValues(e){assertEnum(e);return Object.freeze([...Object.values(e)])}
export function enumEntries(e){assertEnum(e);return Object.freeze(Object.entries(e).map(Object.freeze))}
export function reverseLookup(e,v){assertEnum(e);for(const [k,x] of Object.entries(e))if(Object.is(x,v))return k;return null}
