import { AssertionError } from "../errors/index.js";
export function assert(condition, message = "Assertion failed.", details = {}) { if (!condition) throw new AssertionError(message, { details }); }
export default assert;
