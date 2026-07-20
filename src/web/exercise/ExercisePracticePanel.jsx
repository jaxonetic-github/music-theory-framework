import { useEffect, useId, useRef, useState } from "react";
import {
    buildExerciseApplicationRequest,
    createInitialExercisePracticeState,
    exerciseChoicesForFamily,
    exerciseDirectionOptions,
    exerciseDurationOptions,
    exerciseFamilyOptions,
    isScaleExerciseFamily,
    transitionExercisePracticeState
} from "./workflow.js";
import { useExercisePracticeWorkflow } from "./useExercisePracticeWorkflow.js";

const label = value => String(value).replaceAll("-", " ");
const safeMessage = error => error?.cause?.message ?? error?.message ?? "Exercise generation could not be completed.";

function ExerciseError({ title, error }) {
    if (!error) return null;
    const context = [error.stage ? `${error.stage} stage` : null, error.rowId ? `row ${error.rowId}` : null].filter(Boolean).join(", ");
    return <div className="exercise-error" role="alert"><strong>{title}{context ? ` (${context})` : ""}.</strong> {safeMessage(error)}</div>;
}

function ExerciseControls({ state, catalogs, busy, onChange, onSubmit }) {
    const id = useId();
    const isScale = isScaleExerciseFamily(state.type);
    const choices = exerciseChoicesForFamily(catalogs, state.type);
    return <form className="exercise-controls" aria-labelledby={`${id}-title`} aria-busy={busy} onSubmit={onSubmit}>
        <h3 id={`${id}-title`}>Configure an exercise</h3>
        <fieldset className="exercise-family"><legend>Exercise family</legend>
            <div className="exercise-choice-grid">{exerciseFamilyOptions.map(option => <label key={option.id} className={state.type === option.id ? "choice active" : "choice"}>
                <input type="radio" name={`${id}-family`} value={option.id} checked={state.type === option.id} onChange={() => onChange({ type: option.id })} />
                <span>{option.label}</span>
            </label>)}</div>
        </fieldset>
        <div className="exercise-field-grid">
            <label className="field"><span>All keys</span><span className="check-field"><input type="checkbox" aria-label="All keys" checked={state.allKeys} onChange={event => onChange({ allKeys: event.target.checked })} /> Use canonical all-key order</span></label>
            {!state.allKeys && <label className="field"><span>Root</span><input aria-label="Exercise root" value={state.root} required autoComplete="off" onChange={event => onChange({ root: event.target.value })} /><small>Exact spellings such as Eb, F#, Cb, and B# are preserved.</small></label>}
            <label className="field"><span>{isScale ? "Exercise pattern" : "Exercise quality"}</span><select aria-label={isScale ? "Exercise scale pattern" : "Exercise chord quality"} value={isScale ? state.pattern : state.quality} onChange={event => onChange({ [isScale ? "pattern" : "quality"]: event.target.value })}>{choices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label className="field"><span>Direction</span><select aria-label="Exercise direction" value={state.direction} onChange={event => onChange({ direction: event.target.value })}>{exerciseDirectionOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className="field"><span>Octave count</span><select aria-label="Exercise octave count" value={state.octaves} onChange={event => onChange({ octaves: Number(event.target.value) })}><option value="1">One octave</option><option value="2">Two octaves</option></select></label>
            <label className="field"><span>Starting octave</span><select aria-label="Exercise starting octave" value={state.startingOctave} onChange={event => onChange({ startingOctave: Number(event.target.value) })}>{[2,3,4,5,6].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="field"><span>Notation duration</span><select aria-label="Exercise notation duration" value={state.duration} onChange={event => onChange({ duration: event.target.value })}>{exerciseDurationOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className="field"><span>Clef</span><select aria-label="Exercise clef" value={state.clef} onChange={event => onChange({ clef: event.target.value })}><option value="treble">Treble</option><option value="bass">Bass</option></select></label>
            <label className="field"><span>Time signature</span><select aria-label="Exercise time signature" value={`${state.beats}/${state.beatUnit}`} onChange={event => { const [beats, beatUnit] = event.target.value.split("/").map(Number); onChange({ beats, beatUnit }); }}><option value="4/4">4/4</option><option value="3/4">3/4</option><option value="2/4">2/4</option><option value="6/8">6/8</option></select></label>
            <label className="field"><span>Measures per system</span><select aria-label="Exercise measures per system" value={state.measuresPerSystem} onChange={event => onChange({ measuresPerSystem: Number(event.target.value) })}>{[1,2,3,4,6,8].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="field"><span>Key-signature policy</span><select aria-label="Exercise key-signature policy" value={state.keySignaturePolicy} onChange={event => onChange({ keySignaturePolicy: event.target.value })}><option value="none">None</option><option value="exercise-root">Exercise root</option><option value="explicit">Explicit</option></select></label>
            {state.keySignaturePolicy === "explicit" && <>
                <label className="field"><span>Explicit key tonic</span><input aria-label="Explicit key signature tonic" value={state.keySignatureTonic} required onChange={event => onChange({ keySignatureTonic: event.target.value })} /></label>
                <label className="field"><span>Explicit key mode</span><select aria-label="Explicit key signature mode" value={state.keySignatureMode} onChange={event => onChange({ keySignatureMode: event.target.value })}><option value="major">Major</option><option value="minor">Minor</option></select></label>
            </>}
        </div>
        <button className="primary-action" type="submit" disabled={busy}>{busy ? "Generating exercise…" : "Generate Exercise"}</button>
    </form>;
}

function PresentationRow({ row }) {
    return <article className="exercise-row" aria-labelledby={`${row.id}-title`}>
        <header><div><p className="eyebrow">{label(row.type)}</p><h4 id={`${row.id}-title`}>{row.title}</h4></div><span className="result-badge">{String(row.root)}</span></header>
        <dl className="exercise-row-meta"><div><dt>Family</dt><dd>{label(row.type)}</dd></div>{row.pattern && <div><dt>Pattern</dt><dd>{row.pattern}</dd></div>}{row.quality && <div><dt>Quality</dt><dd>{row.quality}</dd></div>}</dl>
        <ol className="exercise-systems" aria-label={`Semantic systems for ${row.title}`}>{row.systems.map(system => <li key={system.id}>System {system.sequence}: {system.measureIds.length} {system.measureIds.length === 1 ? "measure" : "measures"}</li>)}</ol>
        <div className="exercise-svg-frame" role="img" aria-label={`Notation for ${row.title}`} dangerouslySetInnerHTML={{ __html: row.content }} />
    </article>;
}

function ExercisePresentation({ result, stale, resultRef }) {
    if (!result) return <div className="exercise-empty"><p>No exercise has been generated yet.</p></div>;
    const document = result.presentation;
    return <div className="exercise-document" ref={resultRef} tabIndex="-1" aria-label="Generated exercise presentation">
        <header className="exercise-result-header"><div><p className="eyebrow">Completed exercise result</p><h3>{document.model.sections[0]?.title ?? "Exercise presentation"}</h3></div>{stale && <p className="stale-notice" role="status">Controls changed — generate again to update this result.</p>}</header>
        {document.sections.map(section => <section key={section.id} aria-labelledby={`${section.id}-title`}><h3 id={`${section.id}-title`}>{section.title}</h3>{section.rows.map(row => <PresentationRow key={row.id} row={row} />)}</section>)}
    </div>;
}

export function ExercisePracticePanel({ engine, catalogs }) {
    const [state, setState] = useState(() => createInitialExercisePracticeState(catalogs));
    const [stale, setStale] = useState(false);
    const { workflow, submit, setInputError } = useExercisePracticeWorkflow(engine);
    const resultRef = useRef(null);
    const errorRef = useRef(null);
    const previousResult = useRef(null);
    useEffect(() => {
        if (workflow.result && workflow.result !== previousResult.current) { previousResult.current = workflow.result; setStale(false); resultRef.current?.focus(); }
    }, [workflow.result]);
    useEffect(() => { if (workflow.inputError || workflow.workflowError || workflow.presentationError) errorRef.current?.focus(); }, [workflow.inputError, workflow.workflowError, workflow.presentationError]);
    const change = value => { setState(current => transitionExercisePracticeState(current, value, catalogs)); if (workflow.result) setStale(true); };
    const generate = event => {
        event.preventDefault();
        let request;
        try { request = buildExerciseApplicationRequest(state); }
        catch (error) { setInputError(error); return; }
        void submit(request).catch(() => {});
    };
    return <section className="exercise-practice" aria-labelledby="exercise-practice-title">
        <div className="exercise-practice-heading"><p className="eyebrow">v8.3 · React adapter</p><h2 id="exercise-practice-title">Exercise Practice</h2><p>Configure and render a semantic exercise through the active ExerciseApplication workflow. Audio and downloads are intentionally unavailable here.</p></div>
        <div className="exercise-workspace">
            <ExerciseControls state={state} catalogs={catalogs} busy={workflow.busy} onChange={change} onSubmit={generate} />
            <section className="exercise-results" aria-label="Exercise results" aria-busy={workflow.busy}>
                <div className="exercise-live" role={workflow.busy ? "status" : undefined} aria-live="polite" aria-atomic="true">{workflow.busy ? "Generating exercise…" : workflow.result ? "Exercise presentation ready." : "Ready to generate an exercise."}</div>
                <div ref={errorRef} tabIndex="-1"><ExerciseError title="Input validation failed" error={workflow.inputError} /><ExerciseError title="Exercise workflow failed" error={workflow.workflowError} /><ExerciseError title="Presentation validation failed" error={workflow.presentationError} /></div>
                <ExercisePresentation result={workflow.result} stale={stale} resultRef={resultRef} />
            </section>
        </div>
    </section>;
}

export const ExercisePracticeApp = ExercisePracticePanel;
export default ExercisePracticePanel;
