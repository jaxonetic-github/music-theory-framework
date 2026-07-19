import { ImmutableValue, ValidationError } from "../../Foundation/index.js";
import { Duration } from "./Duration.js";

export class Rest extends ImmutableValue {
    constructor(value = {}) {
        if (value instanceof Rest) return value;
        const offset = Number(value.offset ?? 0);
        if (!Number.isFinite(offset) || offset < 0) throw new ValidationError("A rest offset must be non-negative.");
        super({ duration: Duration.from(value.duration), offset });
    }

    static from(value) { return value instanceof Rest ? value : new Rest(value); }
    toString() { return `rest:${this.duration}`; }
}

export default Rest;
