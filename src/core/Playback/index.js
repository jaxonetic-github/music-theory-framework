export { PlaybackRequest } from "./PlaybackRequest.js";
export { PlaybackEvent } from "./PlaybackEvent.js";
export { PlaybackPlan } from "./PlaybackPlan.js";
export { PlaybackStrategyRegistry } from "./PlaybackStrategyRegistry.js";
export { PlaybackEngine } from "./PlaybackEngine.js";
export { PlaybackModule } from "./PlaybackModule.js";
export { PlaybackStrategy, ScorePlaybackPlanner } from "./strategies/index.js";
export { playbackServiceDescriptors, defaultPlaybackPluginDescriptor, playbackStrategyDescriptors } from "./descriptors.js";
export { playbackPackageDescriptor } from "./package.descriptor.js";

import { PlaybackRequest } from "./PlaybackRequest.js";
import { PlaybackEvent } from "./PlaybackEvent.js";
import { PlaybackPlan } from "./PlaybackPlan.js";
import { PlaybackStrategyRegistry } from "./PlaybackStrategyRegistry.js";
import { PlaybackEngine } from "./PlaybackEngine.js";
import { PlaybackModule } from "./PlaybackModule.js";
import { PlaybackStrategy, ScorePlaybackPlanner } from "./strategies/index.js";
import { playbackServiceDescriptors, defaultPlaybackPluginDescriptor, playbackStrategyDescriptors } from "./descriptors.js";
import { playbackPackageDescriptor } from "./package.descriptor.js";

export const Playback = Object.freeze({
    PlaybackRequest,
    PlaybackEvent,
    PlaybackPlan,
    PlaybackStrategyRegistry,
    PlaybackEngine,
    PlaybackModule,
    PlaybackStrategy,
    ScorePlaybackPlanner,
    serviceDescriptors: playbackServiceDescriptors,
    pluginDescriptor: defaultPlaybackPluginDescriptor,
    strategyDescriptors: playbackStrategyDescriptors,
    descriptor: playbackPackageDescriptor
});

export default Playback;
