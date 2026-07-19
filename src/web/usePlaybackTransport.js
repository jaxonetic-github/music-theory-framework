import { useCallback, useEffect, useSyncExternalStore } from "react";

const activeStates = new Set(["starting", "scheduled", "playing"]);

export function usePlaybackTransport(transport) {
    if (!transport || typeof transport.subscribe !== "function" || !("snapshot" in transport)) {
        throw new TypeError("usePlaybackTransport requires a playback transport.");
    }
    const subscribe = useCallback(listener => transport.subscribe(listener), [transport]);
    const getSnapshot = useCallback(() => transport.snapshot, [transport]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useStopActivePlaybackOnCleanup(transport) {
    useEffect(() => {
        const capturedTransport = transport;
        return () => {
            if (activeStates.has(capturedTransport.snapshot.state)) {
                try { capturedTransport.stop(); } catch {}
            }
        };
    }, [transport]);
}

export default usePlaybackTransport;
