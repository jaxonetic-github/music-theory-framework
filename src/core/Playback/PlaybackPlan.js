import { cloneDeep, freezeDeep, ValidationError } from "../Foundation/index.js";
import { PlaybackEvent } from "./PlaybackEvent.js";
import { PlaybackRequest } from "./PlaybackRequest.js";

export class PlaybackPlan {
    constructor({ request, resolution, events = [], totalTicks = 0, metadata = {} } = {}) {
        const normalizedRequest = PlaybackRequest.from(request);
        const normalizedResolution = Number(resolution);
        const normalizedTotal = Number(totalTicks);
        if (!Number.isSafeInteger(normalizedResolution) || normalizedResolution < 1) {
            throw new ValidationError("A playback plan requires a positive safe integer resolution.");
        }
        if (!Number.isSafeInteger(normalizedTotal) || normalizedTotal < 0) {
            throw new ValidationError("A playback plan requires a non-negative safe integer total tick count.");
        }
        const normalizedEvents = Object.freeze([...events]);
        normalizedEvents.forEach((event, index) => {
            if (!(event instanceof PlaybackEvent)) throw new ValidationError("Playback plans may contain only PlaybackEvent values.");
            if (event.sequence !== index + 1) throw new ValidationError("Playback event sequence values must be contiguous and ordered.");
            if (event.endTick > normalizedTotal) throw new ValidationError("Playback event exceeds the plan total tick count.");
        });
        Object.defineProperties(this, {
            request: { value: normalizedRequest, enumerable: true },
            resolution: { value: normalizedResolution, enumerable: true },
            events: { value: normalizedEvents, enumerable: true },
            totalTicks: { value: normalizedTotal, enumerable: true },
            metadata: { value: freezeDeep(cloneDeep(metadata)), enumerable: true }
        });
        Object.freeze(this);
    }

    ticksToSeconds(ticks) {
        const value = Number(ticks);
        if (!Number.isSafeInteger(value) || value < 0) throw new ValidationError("Ticks must be a non-negative safe integer.");
        const seconds = value * 60 / (this.request.tempo * this.resolution);
        if (!Number.isFinite(seconds)) throw new ValidationError("Derived playback seconds exceed the finite number range.");
        return seconds;
    }
}

export default PlaybackPlan;
