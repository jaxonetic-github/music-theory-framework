import { canonicalSerialize, Identifier, ValidationError } from "../Foundation/index.js";
import { EXERCISE_SET_LIMITS } from "./limits.js";

function digest(value) {
    let hash = 0xcbf29ce484222325n;
    for (const character of value) {
        hash ^= BigInt(character.codePointAt(0));
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16,"0");
}
function token(value) { return String(value??"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "generated"; }

export function boundedExerciseSetId({ kind, readable, identity, maxLength=EXERCISE_SET_LIMITS.idLength }={}) {
    if (!Number.isSafeInteger(maxLength) || maxLength < 24 || maxLength > EXERCISE_SET_LIMITS.idLength) throw new ValidationError(`Generated ExerciseSet ID length must be between 24 and ${EXERCISE_SET_LIMITS.idLength}.`);
    let serialized; try { serialized=canonicalSerialize({kind:String(kind),identity}); } catch(cause) { throw new ValidationError(`Generated ExerciseSet identity must be canonical: ${cause.message}`,{cause}); }
    const suffix=digest(serialized),prefix=token(`${kind}-${readable}`),available=maxLength-suffix.length-1,result=`${prefix.slice(0,available).replace(/-+$/,"")||"generated"}-${suffix}`;
    try { Identifier.from(result); } catch(cause) { throw new ValidationError(`Generated ExerciseSet ID is invalid: ${cause.message}`,{cause}); }
    return result;
}
