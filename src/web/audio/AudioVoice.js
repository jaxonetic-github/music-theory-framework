export class AudioVoice {
    constructor(value) {
        Object.defineProperties(this, Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, { value: entry, enumerable: true }])));
        Object.freeze(this);
    }
}

export default AudioVoice;
