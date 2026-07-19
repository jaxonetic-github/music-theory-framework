import { useCallback, useEffect, useRef, useState } from "react";
import { useApplicationRuntime, useApplicationWorkflow } from "./ApplicationProvider.jsx";
import { downloadExport, exportFilenameBase } from "./download.js";
import { usePlaybackTransport } from "./usePlaybackTransport.js";
import {
    buildWorkflowRequest,
    createInitialWorkflowState,
    transitionWorkflow,
    workflowPitches,
    workflowTitle
} from "./workflow.js";

function StageError({ error }) {
    const stage = error?.stage ? `${error.stage} stage` : "application bootstrap";
    const message = error?.cause?.message ?? error?.message ?? "An unexpected error occurred.";
    return <div className="status status-error" role="alert"><strong>{stage} failed.</strong> {message}</div>;
}

function WorkflowControls({ catalogs, state, onChange, onSubmit, loading }) {
    const patterns = state.type === "scale" ? catalogs.scales : catalogs.chords;
    const selection = state.type === "scale" ? state.pattern : state.quality;
    const selectionKey = state.type === "scale" ? "pattern" : "quality";
    return (
        <form className="control-panel" aria-labelledby="controls-title" onSubmit={onSubmit}>
            <div className="section-heading">
                <p className="eyebrow">Workflow input</p>
                <h2 id="controls-title">Build a theory request</h2>
            </div>
            <fieldset className="type-switch">
                <legend>Workflow type</legend>
                {[
                    ["scale", "Scale"],
                    ["chord", "Chord"]
                ].map(([value, label]) => (
                    <label key={value} className={state.type === value ? "choice active" : "choice"}>
                        <input type="radio" name="workflow-type" value={value} checked={state.type === value}
                            onChange={() => onChange({ type: value })} />
                        <span>{label}</span>
                    </label>
                ))}
            </fieldset>

            <div className="field-grid">
                <label className="field" htmlFor="root-pitch">
                    <span>Root pitch</span>
                    <input id="root-pitch" name="root" aria-label="Root pitch" value={state.root} required autoComplete="off"
                        onChange={event => onChange({ root: event.target.value })} />
                    <small>Try Eb, F#, Cb, or B#.</small>
                </label>
                <label className="field" htmlFor="pattern-selection">
                    <span>{state.type === "scale" ? "Scale pattern" : "Chord quality"}</span>
                    <select id="pattern-selection" name={selectionKey}
                        aria-label={state.type === "scale" ? "Scale pattern" : "Chord quality"} value={selection}
                        onChange={event => onChange({ [selectionKey]: event.target.value })}>
                        {patterns.map(pattern => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
                    </select>
                </label>
                <label className="field" htmlFor="octave">
                    <span>Octave</span>
                    <select id="octave" name="octave" aria-label="Octave" value={state.octave}
                        onChange={event => onChange({ octave: Number(event.target.value) })}>
                        {[2, 3, 4, 5, 6].map(octave => <option key={octave} value={octave}>{octave}</option>)}
                    </select>
                </label>
            </div>

            <fieldset className="output-options">
                <legend>Outputs</legend>
                <label><input type="checkbox" checked={state.renderingEnabled}
                    onChange={event => onChange({ renderingEnabled: event.target.checked })} /> Render trusted SVG score</label>
                <label><input type="checkbox" checked={state.exportEnabled}
                    onChange={event => onChange({ exportEnabled: event.target.checked })} /> Prepare MusicXML export</label>
            </fieldset>

            <button className="primary-action" type="submit" disabled={loading}>
                {loading ? "Generating…" : `Generate ${state.type}`}
            </button>
        </form>
    );
}

const activePlaybackStates = new Set(["starting", "scheduled", "playing"]);
const replayPlaybackStates = new Set(["stopped", "completed", "failed"]);
const playbackLabels = Object.freeze({
    idle: "Playback is idle.",
    ready: "Playback is ready.",
    starting: "Starting playback…",
    scheduled: "Playback is scheduled.",
    playing: "Playback is playing.",
    stopped: "Playback is stopped.",
    completed: "Playback completed.",
    failed: "Playback failed."
});

function playbackErrorMessage(error) {
    const message = error?.cause?.message ?? error?.message ?? "Playback could not be completed.";
    if (error?.name === "NotAllowedError" || /autoplay|user gesture|not allowed/i.test(message)) {
        return `${message} Your browser requires playback to begin from a Play or Replay action.`;
    }
    return message;
}

function PlaybackControls({ plan, snapshot, planningError, commandError, pendingAction, onPlay, onStop, onReplay }) {
    const available = Boolean(plan) && snapshot.plan === plan;
    const active = available && activePlaybackStates.has(snapshot.state);
    const terminal = available && replayPlaybackStates.has(snapshot.state);
    const playDisabled = !available || active || pendingAction === "play" || pendingAction === "replay";
    const stopDisabled = !active || pendingAction === "stop";
    const replayDisabled = !terminal || pendingAction !== null;
    const executionError = commandError ?? (snapshot.state === "failed" ? snapshot.error : null);
    return (
        <section className="playback-section" aria-labelledby="playback-title">
            <h3 id="playback-title">Playback</h3>
            <fieldset className="playback-controls">
                <legend>Playback controls</legend>
                <div className="playback-actions">
                    <button type="button" onClick={onPlay} disabled={playDisabled}>Play</button>
                    <button type="button" onClick={onStop} disabled={stopDisabled}>Stop</button>
                    <button type="button" onClick={onReplay} disabled={replayDisabled}>Replay</button>
                </div>
            </fieldset>
            {!planningError && !executionError && (
                <p className="playback-status" role="status" aria-live="polite" aria-atomic="true">
                    {available ? playbackLabels[snapshot.state] ?? "Playback status unavailable." : "Playback is unavailable for this result."}
                </p>
            )}
            {planningError && <div className="playback-error" role="alert"><strong>Playback planning failed.</strong> {playbackErrorMessage(planningError)}</div>}
            {!planningError && executionError && <div className="playback-error" role="alert"><strong>Playback failed.</strong> {playbackErrorMessage(executionError)}</div>}
        </section>
    );
}

function WorkflowResult({ workflow, playback }) {
    if (workflow.status === "empty") {
        return <div className="status empty-state"><p className="eyebrow">Ready</p><h2>Your score will appear here</h2><p>Choose a workflow and generate an immutable result.</p></div>;
    }
    if (workflow.status === "loading") {
        return <>
            <div className="status loading-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> Generating theory, notation, and requested outputs…</div>
            {playback.commandError && <div className="playback-error" role="alert"><strong>Transport cleanup failed.</strong> {playbackErrorMessage(playback.commandError)}</div>}
        </>;
    }
    if (workflow.status === "error") return <>
        <StageError error={workflow.error} />
        {playback.commandError && <div className="playback-error" role="alert"><strong>Transport cleanup failed.</strong> {playbackErrorMessage(playback.commandError)}</div>}
    </>;

    const result = workflow.result;
    const title = workflowTitle(result);
    const pitches = workflowPitches(result);
    return (
        <article className="result-card" aria-labelledby="result-title">
            <header className="result-header">
                <div><p className="eyebrow">Generated result</p><h2 id="result-title">{title}</h2></div>
                <span className="result-badge">{result.request.type}</span>
            </header>
            <section aria-labelledby="pitches-title">
                <h3 id="pitches-title">Written pitches</h3>
                <ul className="pitch-list">{pitches.map((pitch, index) => <li key={`${pitch}-${index}`}>{pitch}</li>)}</ul>
                <p className="octave-note">Notation octave: {result.request.notationOptions.octave}</p>
            </section>
            <section aria-labelledby="metadata-title">
                <h3 id="metadata-title">Workflow metadata</h3>
                <dl className="metadata-list">
                    <div><dt>Generator</dt><dd>{result.metadata.generation.generatorId}</dd></div>
                    <div><dt>Notation</dt><dd>{result.metadata.notation.strategyId}</dd></div>
                    <div><dt>Renderer</dt><dd>{result.metadata.rendering?.strategyId ?? "Not requested"}</dd></div>
                    <div><dt>Exporter</dt><dd>{result.metadata.export?.strategyId ?? "Not requested"}</dd></div>
                </dl>
            </section>
            <PlaybackControls {...playback} />
            {result.rendering && (
                <section className="score-section" aria-labelledby="score-title">
                    <h3 id="score-title">Rendered score</h3>
                    <div className="svg-frame" role="img" aria-label={`Rendered score for ${title}`}
                        dangerouslySetInnerHTML={{ __html: result.rendering.content }} />
                </section>
            )}
            <button type="button" className="download-action" disabled={!result.export}
                onClick={() => downloadExport(result.export, { filenameBase: exportFilenameBase(result) })}>
                Download {title || "score"} as MusicXML
            </button>
        </article>
    );
}

function ReadyApplication({ runtime }) {
    const { workflow, run } = useApplicationWorkflow();
    const snapshot = usePlaybackTransport(runtime.transport);
    const [state, setState] = useState(() => createInitialWorkflowState(runtime.catalogs));
    const [playback, setPlayback] = useState({ result: null, plan: null, planningError: null, commandError: null, pendingAction: null });
    const planned = useRef({ result: null, engine: null, plan: null });
    const commandSequence = useRef(0);
    const pendingAction = useRef(null);
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    useEffect(() => {
        if (workflow.status !== "success") return;
        const result = workflow.result;
        try {
            let plan;
            if (planned.current.result === result && planned.current.engine === runtime.playback) plan = planned.current.plan;
            else {
                plan = runtime.playback.plan(result.score);
                planned.current = { result, engine: runtime.playback, plan };
            }
            runtime.transport.load(plan);
            setPlayback({ result, plan, planningError: null, commandError: null, pendingAction: null });
            pendingAction.current = null;
        } catch (error) {
            try {
                if (activePlaybackStates.has(runtime.transport.snapshot.state)) runtime.transport.stop();
            } catch {}
            setPlayback({ result, plan: null, planningError: error, commandError: null, pendingAction: null });
            pendingAction.current = null;
        }
    }, [workflow.status, workflow.result, runtime.playback, runtime.transport]);

    useEffect(() => () => {
        commandSequence.current += 1;
        pendingAction.current = null;
        if (activePlaybackStates.has(snapshotRef.current.state)) {
            try { runtime.transport.stop(); } catch {}
        }
    }, [runtime.transport]);

    const currentPlan = workflow.status === "success" && playback.result === workflow.result ? playback.plan : null;
    const currentPlanningError = workflow.status === "success" && playback.result === workflow.result ? playback.planningError : null;

    const command = useCallback((action, operation) => {
        if (pendingAction.current === action) return Promise.resolve(runtime.transport.snapshot);
        const current = ++commandSequence.current;
        pendingAction.current = action;
        setPlayback(value => ({ ...value, commandError: null, pendingAction: action }));
        let result;
        try { result = operation(); }
        catch (error) { result = Promise.reject(error); }
        return Promise.resolve(result).then(value => {
            if (commandSequence.current === current) {
                pendingAction.current = null;
                setPlayback(currentValue => ({ ...currentValue, pendingAction: null }));
            }
            return value;
        }).catch(error => {
            if (commandSequence.current === current) {
                pendingAction.current = null;
                setPlayback(value => ({ ...value, commandError: error, pendingAction: null }));
            }
            return null;
        });
    }, [runtime.transport]);

    const stopForWorkflow = useCallback(() => {
        commandSequence.current += 1;
        pendingAction.current = null;
        if (!activePlaybackStates.has(runtime.transport.snapshot.state)) return;
        try {
            runtime.transport.stop();
            setPlayback(value => ({ ...value, commandError: null, pendingAction: null }));
        } catch (error) {
            setPlayback(value => ({ ...value, commandError: error, pendingAction: null }));
        }
    }, [runtime.transport]);

    const update = change => setState(current => transitionWorkflow(current, change, runtime.catalogs));
    const submit = event => {
        event.preventDefault();
        stopForWorkflow();
        void run(buildWorkflowRequest(state)).catch(() => {});
    };
    return (
        <main className="app-shell">
            <header className="hero">
                <p className="eyebrow">Music Theory Framework · v7.6</p>
                <h1>From theory to score,<br /><em>without losing the spelling.</em></h1>
                <p>Run the headless workflow through an accessible React adapter. Generate, notate, render SVG, and prepare MusicXML—all from the same immutable score.</p>
            </header>
            <div className="workspace">
                <WorkflowControls catalogs={runtime.catalogs} state={state} onChange={update} onSubmit={submit}
                    loading={workflow.status === "loading"} />
                <section className="results-panel" aria-label="Workflow results">
                    <WorkflowResult workflow={workflow} playback={{
                        plan: currentPlan,
                        snapshot,
                        planningError: currentPlanningError,
                        commandError: playback.commandError,
                        pendingAction: playback.pendingAction,
                        onPlay: () => { void command("play", () => runtime.transport.play()); },
                        onStop: () => { void command("stop", () => runtime.transport.stop()); },
                        onReplay: () => { void command("replay", () => runtime.transport.replay()); }
                    }} />
                </section>
            </div>
        </main>
    );
}

export function MusicTheoryWebApp() {
    const runtime = useApplicationRuntime();
    if (runtime.status === "loading") return <main className="bootstrap-state" aria-busy="true"><div role="status" aria-live="polite">Starting music theory services…</div></main>;
    if (runtime.status === "error") return <main className="bootstrap-state"><StageError error={runtime.error} /></main>;
    return <ReadyApplication runtime={runtime.value} />;
}

export default MusicTheoryWebApp;
