import { ValidationError } from "../../Foundation/index.js";

export function chordMemberRoles(pattern) {
    const intervals = pattern?.intervals;
    if (!Array.isArray(intervals) || ![3, 4].includes(intervals.length)) {
        throw new ValidationError("Advanced exercise chord targets require a triad or seventh-chord pattern.");
    }
    if (intervals.length === 4) return Object.freeze([1, 3, 5, 7]);
    const middle = intervals[1] === 2 ? 2 : intervals[1] === 5 ? 4 : 3;
    return Object.freeze([1, middle, 5]);
}

export default chordMemberRoles;
