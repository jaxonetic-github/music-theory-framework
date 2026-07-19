import { cloneDeep, freezeDeep } from "../../core/index.js";

export class PlaybackTransportSnapshot {
    constructor({ state, plan, sessionId, operationSequence, error }) {
        Object.defineProperties(this, {
            state: { value: state, enumerable: true },
            hasPlan: { value: plan !== null, enumerable: true },
            plan: { value: plan, enumerable: true },
            planId: { value: plan?.metadata?.scoreId ?? null, enumerable: true },
            sessionId: { value: sessionId ?? null, enumerable: true },
            operationSequence: { value: operationSequence, enumerable: true },
            error: { value: error === null ? null : freezeDeep(cloneDeep(error)), enumerable: true }
        });
        Object.freeze(this);
    }
}

export default PlaybackTransportSnapshot;
