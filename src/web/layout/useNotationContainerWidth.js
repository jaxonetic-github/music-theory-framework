import { useEffect, useRef, useState } from "react";

export function useNotationContainerWidth({ ResizeObserver: Observer } = {}) {
    const ref = useRef(null), latest = useRef(null), scheduled = useRef(false), mounted = useRef(false), [width, setWidth] = useState(null);
    useEffect(() => {
        mounted.current = true;
        const Constructor = Observer ?? globalThis.ResizeObserver;
        if (typeof Constructor !== "function" || !ref.current) return () => { mounted.current = false; };
        const observer = new Constructor(entries => {
            const value = Math.round(Number(entries.at(-1)?.contentRect?.width ?? 0));
            if (!Number.isFinite(value) || value <= 0) return;
            const normalized = Math.max(160, Math.min(10000, value)); if (normalized === latest.current) return; latest.current = normalized;
            if (scheduled.current) return; scheduled.current = true;
            Promise.resolve().then(() => { scheduled.current = false; if (mounted.current) setWidth(current => current === latest.current ? current : latest.current); });
        });
        observer.observe(ref.current);
        return () => { mounted.current = false; scheduled.current = false; observer.disconnect(); };
    }, [Observer]);
    return Object.freeze({ ref, width });
}
