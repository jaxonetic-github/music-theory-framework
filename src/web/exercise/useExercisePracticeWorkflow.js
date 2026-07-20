import { useCallback, useEffect, useRef, useState } from "react";
import { validateExercisePresentation } from "./presentation.js";

const initial = Object.freeze({ busy: false, result: null, inputError: null, workflowError: null, presentationError: null });

export function useExercisePracticeWorkflow(engine) {
    const [workflow, setWorkflow] = useState(initial);
    const sequence = useRef(0);
    const mounted = useRef(true);
    const busy = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; sequence.current += 1; busy.current = false; };
    }, []);

    const setInputError = useCallback(error => {
        if (mounted.current) setWorkflow(value => Object.freeze({ ...value, inputError: error, workflowError: null, presentationError: null }));
    }, []);

    const run = useCallback(request => {
        if (!engine || typeof engine.run !== "function") return Promise.reject(new TypeError("ExerciseApplicationEngine is unavailable."));
        const operation = ++sequence.current;
        busy.current = true;
        if (mounted.current) setWorkflow(value => Object.freeze({ ...value, busy: true, inputError: null, workflowError: null, presentationError: null }));
        let pending;
        try { pending = engine.run(request); }
        catch (error) { pending = Promise.reject(error); }
        let invalidPresentation = null;
        return Promise.resolve(pending).then(result => {
            let presentationError = null;
            try { validateExercisePresentation(result); } catch (error) { presentationError = error; }
            invalidPresentation = presentationError;
            if (mounted.current && sequence.current === operation) {
                busy.current = false;
                setWorkflow(value => Object.freeze({ ...value, busy: false, ...(presentationError ? { presentationError } : { result }), workflowError: null }));
            }
            if (presentationError) throw presentationError;
            return result;
        }).catch(error => {
            if (mounted.current && sequence.current === operation) {
                busy.current = false;
                setWorkflow(value => Object.freeze({ ...value, busy: false, ...(invalidPresentation === error ? {} : { workflowError: error }) }));
            }
            throw error;
        });
    }, [engine]);

    const submit = useCallback(request => {
        if (busy.current) return Promise.resolve(null);
        return run(request);
    }, [run]);

    return Object.freeze({ workflow, run, submit, setInputError });
}

export default useExercisePracticeWorkflow;
