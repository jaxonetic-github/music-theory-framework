import { PluginDescriptor, ServiceDescriptor } from "../../core/index.js";

export const webAudioServiceDescriptor = new ServiceDescriptor({
    id: "web.audio.playback", name: { value: "web-audio-playback", displayName: "Web Audio Playback Adapter" },
    description: "Executes immutable PlaybackPlan values through an injected or browser-resolved AudioContext.",
    layer: "presentation", category: "application", role: "service", stability: "stable", visibility: "public",
    capabilities: ["playback-plan-execution", "web-audio", "oscillator-synthesis", "deterministic-audio-scheduling"],
    contracts: [{ id: "playback.plan", kind: "value" }],
    metadata: { attributes: { browserScoped: true, playbackPlanner: false, renderer: false, midi: false } }
});

export const webAudioPluginDescriptor = new PluginDescriptor({
    id: "web.audio.oscillator", name: { value: "web-audio-oscillator", displayName: "Web Audio Oscillator Playback" },
    description: "Browser-only oscillator execution for canonical immutable playback plans.",
    layer: "plugin", category: "plugin", role: "provider", stability: "stable", visibility: "public",
    capabilities: ["playback-plan-execution", "oscillator-voice", "gain-envelope"],
    services: [{ id: "web.audio.playback", kind: "service" }],
    extensionPoints: [{ id: "web.audio.playback-adapter", kind: "service" }]
});
