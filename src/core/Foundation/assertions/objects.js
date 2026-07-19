import { AssertionError } from "../errors/index.js";
export function assertPlainObject(v,n="value"){const p=v&&typeof v==="object"&&!Array.isArray(v)?Object.getPrototypeOf(v):undefined;if(p!==Object.prototype&&p!==null)throw new AssertionError(`${n} must be a plain object.`)}
export function assertFrozen(v,n="value"){if(v===null||!(typeof v==="object"||typeof v==="function")||!Object.isFrozen(v))throw new AssertionError(`${n} must be frozen.`)}
export function assertArray(v,n="value"){if(!Array.isArray(v))throw new AssertionError(`${n} must be an array.`)}
export function assertInstanceOf(v,C,n="value"){if(!(v instanceof C))throw new AssertionError(`${n} must be an instance of ${C?.name??"the supplied type"}.`)}
