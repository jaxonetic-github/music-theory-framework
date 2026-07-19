import { AssertionError } from "../errors/index.js";
export function assertDefined(v,n="value"){if(v===undefined)throw new AssertionError(`${n} must be defined.`)}
export function assertString(v,n="value"){if(typeof v!=="string")throw new AssertionError(`${n} must be a string.`)}
export function assertNonEmptyString(v,n="value"){if(typeof v!=="string"||!v.trim())throw new AssertionError(`${n} must be a non-empty string.`)}
export function assertNumber(v,n="value"){if(typeof v!=="number"||Number.isNaN(v))throw new AssertionError(`${n} must be a number.`)}
export function assertInteger(v,n="value"){if(!Number.isInteger(v))throw new AssertionError(`${n} must be an integer.`)}
export function assertBoolean(v,n="value"){if(typeof v!=="boolean")throw new AssertionError(`${n} must be a boolean.`)}
export function assertFunction(v,n="value"){if(typeof v!=="function")throw new AssertionError(`${n} must be a function.`)}
