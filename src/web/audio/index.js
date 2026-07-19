export { AudioPlaybackState } from "./AudioPlaybackState.js";
export { AudioPlaybackRequest } from "./AudioPlaybackRequest.js";
export { AudioPlaybackSession } from "./AudioPlaybackSession.js";
export { AudioVoice } from "./AudioVoice.js";
export { WebAudioPlaybackAdapter, midiToFrequency, velocityToGain } from "./WebAudioPlaybackAdapter.js";
export { WebAudioPlaybackModule } from "./WebAudioPlaybackModule.js";
export { webAudioServiceDescriptor, webAudioPluginDescriptor } from "./descriptors.js";
export { webAudioPackageDescriptor } from "./package.descriptor.js";

import { AudioPlaybackState } from "./AudioPlaybackState.js";
import { AudioPlaybackRequest } from "./AudioPlaybackRequest.js";
import { AudioPlaybackSession } from "./AudioPlaybackSession.js";
import { AudioVoice } from "./AudioVoice.js";
import { WebAudioPlaybackAdapter, midiToFrequency, velocityToGain } from "./WebAudioPlaybackAdapter.js";
import { WebAudioPlaybackModule } from "./WebAudioPlaybackModule.js";
import { webAudioServiceDescriptor, webAudioPluginDescriptor } from "./descriptors.js";
import { webAudioPackageDescriptor } from "./package.descriptor.js";

export const WebAudio = Object.freeze({
    AudioPlaybackState, AudioPlaybackRequest, AudioPlaybackSession, AudioVoice,
    WebAudioPlaybackAdapter, WebAudioPlaybackModule, midiToFrequency, velocityToGain,
    serviceDescriptor: webAudioServiceDescriptor, pluginDescriptor: webAudioPluginDescriptor,
    descriptor: webAudioPackageDescriptor
});

export default WebAudio;
