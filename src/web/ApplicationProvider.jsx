import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createWebApplication } from "./bootstrap.js";

const ApplicationContext = createContext(null);

export function ApplicationProvider({ children, bootstrap = createWebApplication, bootstrapOptions }) {
    const [state, setState] = useState({ status: "loading", value: null, error: null });
    const generation = useRef(0);

    useEffect(() => {
        const current = ++generation.current;
        let runtime = null;
        setState({ status: "loading", value: null, error: null });
        Promise.resolve().then(() => bootstrap(bootstrapOptions)).then(value => {
            runtime = value;
            if (generation.current === current) setState({ status: "ready", value, error: null });
            else return value.dispose();
        }).catch(error => {
            if (generation.current === current) setState({ status: "error", value: null, error });
        });
        return () => {
            generation.current += 1;
            if (runtime) void runtime.dispose();
        };
    }, [bootstrap, bootstrapOptions]);

    return <ApplicationContext.Provider value={state}>{children}</ApplicationContext.Provider>;
}

export function useApplicationRuntime() {
    const context = useContext(ApplicationContext);
    if (!context) throw new Error("useApplicationRuntime must be used inside ApplicationProvider.");
    return context;
}

export function useApplicationWorkflow() {
    const runtime = useApplicationRuntime();
    const [workflow, setWorkflow] = useState({ status: "empty", result: null, error: null });
    const requestId = useRef(0);

    useEffect(() => () => { requestId.current += 1; }, []);
    useEffect(() => {
        requestId.current += 1;
        setWorkflow({ status: "empty", result: null, error: null });
    }, [runtime.value]);

    const run = useCallback(request => {
        if (runtime.status !== "ready") return Promise.reject(new Error("The application workflow is not ready."));
        const current = ++requestId.current;
        setWorkflow({ status: "loading", result: null, error: null });
        return Promise.resolve().then(() => runtime.value.application.run(request)).then(result => {
            if (requestId.current === current) setWorkflow({ status: "success", result, error: null });
            return result;
        }).catch(error => {
            if (requestId.current === current) setWorkflow({ status: "error", result: null, error });
            throw error;
        });
    }, [runtime]);

    return Object.freeze({ runtime, workflow, run });
}
