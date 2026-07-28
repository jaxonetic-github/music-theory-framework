import { useEffect, useRef, useState } from "react";
import { validateTrustedSvgContent } from "../exercise/presentation.js";
import { useNotationContainerWidth } from "./useNotationContainerWidth.js";

export function ResponsiveNotation({ row, renderingEngine, profile = "screen-regular", ResizeObserver }) {
    const observed = useNotationContainerWidth({ ResizeObserver }), operation = useRef(0), mounted = useRef(false), [state, setState] = useState(() => ({ content: row.content, error: null, width: null }));
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current += 1; }; }, []);
    useEffect(() => { operation.current += 1; setState({ content: row.content, error: null, width: null }); }, [row]);
    useEffect(() => {
        if (!observed.width || !renderingEngine?.render) return;
        const current = ++operation.current, options = { format: "svg", pluginId: "core.rendering.svg", strategyId: "svg", width: observed.width, layoutProfile: profile, semanticSystems: row.systems.map(system => ({ id: system.id, measureIds: system.measureIds, breakPolicy: system.sourceSystem.breakPolicy })) };
        Promise.resolve().then(() => renderingEngine.render(row.graph, options)).then(content => {
            if (!validateTrustedSvgContent(content)) throw new TypeError("Responsive layout returned untrusted SVG content.");
            if (mounted.current && operation.current === current) setState({ content, error: null, width: observed.width });
        }).catch(error => { if (mounted.current && operation.current === current) setState(value => ({ ...value, error })); });
    }, [row, renderingEngine, profile, observed.width]);
    const overflow = /data-overflow="true"/.test(state.content);
    return <div ref={observed.ref} className="exercise-svg-frame" role="img" aria-label={`Notation for ${row.title}`} data-layout-width={state.width ?? "authoritative"}>
        {state.error && <div className="layout-error" role="alert"><strong>Notation layout failed.</strong> {state.error.message}</div>}
        {overflow && <p className="layout-overflow" role="status">This measure requires horizontal scrolling at the available width.</p>}
        <div className="responsive-svg" dangerouslySetInnerHTML={{ __html: state.content }} />
    </div>;
}
