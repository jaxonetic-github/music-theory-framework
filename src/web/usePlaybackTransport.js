import { useCallback, useSyncExternalStore } from "react";

export function usePlaybackTransport(transport) {
    if (!transport || typeof transport.subscribe !== "function" || !("snapshot" in transport)) {
        throw new TypeError("usePlaybackTransport requires a playback transport.");
    }
    const subscribe = useCallback(listener => transport.subscribe(listener), [transport]);
    const getSnapshot = useCallback(() => transport.snapshot, [transport]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export default usePlaybackTransport;
