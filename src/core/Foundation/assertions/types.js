import { AssertionError } from "../errors/index.js";
export function assertEnum(e,n="enumeration"){if(e===null||typeof e!=="object"||Array.isArray(e)||!Object.isFrozen(e))throw new AssertionError(`${n} must be a frozen enum object.`)}
export function assertEnumValue(e,v,n="value"){assertEnum(e);if(!Object.values(e).some(x=>Object.is(x,v)))throw new AssertionError(`${n} is not a valid enum value.`)}
