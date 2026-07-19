import { useState } from "react";
import { useApplicationRuntime, useApplicationWorkflow } from "./ApplicationProvider.jsx";
import { downloadExport, exportFilenameBase } from "./download.js";
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

function WorkflowResult({ workflow }) {
    if (workflow.status === "empty") {
        return <div className="status empty-state"><p className="eyebrow">Ready</p><h2>Your score will appear here</h2><p>Choose a workflow and generate an immutable result.</p></div>;
    }
    if (workflow.status === "loading") {
        return <div className="status loading-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> Generating theory, notation, and requested outputs…</div>;
    }
    if (workflow.status === "error") return <StageError error={workflow.error} />;

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
    const [state, setState] = useState(() => createInitialWorkflowState(runtime.catalogs));
    const update = change => setState(current => transitionWorkflow(current, change, runtime.catalogs));
    const submit = event => {
        event.preventDefault();
        void run(buildWorkflowRequest(state)).catch(() => {});
    };
    return (
        <main className="app-shell">
            <header className="hero">
                <p className="eyebrow">Music Theory Framework · v7.2</p>
                <h1>From theory to score,<br /><em>without losing the spelling.</em></h1>
                <p>Run the headless workflow through an accessible React adapter. Generate, notate, render SVG, and prepare MusicXML—all from the same immutable score.</p>
            </header>
            <div className="workspace">
                <WorkflowControls catalogs={runtime.catalogs} state={state} onChange={update} onSubmit={submit}
                    loading={workflow.status === "loading"} />
                <section className="results-panel" aria-label="Workflow results">
                    <WorkflowResult workflow={workflow} />
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
