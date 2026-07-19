import { PackageDescriptor } from "../../core/index.js";

export const webAudioPackageDescriptor = new PackageDescriptor({
    id: "web.audio-playback",
    name: { value: "web-audio-playback", displayName: "Web Audio Playback Adapter" },
    description: "Browser-scoped execution of immutable playback plans with deterministic Web Audio scheduling.",
    version: "7.4.0", layer: "presentation", category: "application", role: "provider",
    stability: "stable", visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.kernel", kind: "required" },
        { target: "core.playback", kind: "required" }
    ],
    capabilities: ["web-audio-adapter", "playback-plan-execution", "oscillator-synthesis", "deterministic-scheduling"],
    consumes: [{ id: "playback.plan", kind: "value" }],
    provides: [{ id: "web.audio.playback", kind: "service" }],
    publicApi: [{ id: "web/audio/index.js", kind: "module" }],
    metadata: { tags: ["web", "audio", "playback", "browser", "adapter"] }
});

export default webAudioPackageDescriptor;
