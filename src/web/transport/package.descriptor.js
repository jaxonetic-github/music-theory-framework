import { PackageDescriptor } from "../../core/index.js";

export const playbackTransportPackageDescriptor = new PackageDescriptor({
    id: "web.playback-transport",
    name: { value: "playback-transport", displayName: "Playback Transport Controller" },
    description: "Browser-scoped UI-neutral orchestration of immutable playback plans and audio sessions.",
    version: "7.5.0", layer: "presentation", category: "application", role: "provider",
    stability: "stable", visibility: "public",
    dependencies: [
        { target: "core.foundation", kind: "required" },
        { target: "core.kernel", kind: "required" },
        { target: "core.playback", kind: "required" },
        { target: "web.audio-playback", kind: "required" }
    ],
    capabilities: ["playback-transport", "session-orchestration", "immutable-state", "stale-operation-protection"],
    consumes: [{ id: "playback.plan", kind: "value" }, { id: "web.audio.playback", kind: "service" }],
    provides: [{ id: "web.playback.transport", kind: "service" }],
    publicApi: [{ id: "web/transport/index.js", kind: "module" }],
    metadata: { tags: ["web", "playback", "transport", "controller", "browser"] }
});

export default playbackTransportPackageDescriptor;
