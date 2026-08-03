import { useId, useRef, useState } from "react";
import { ResponsiveNotation } from "../layout/index.js";
import { PublishingPanel } from "../publishing/index.js";

const label=value=>String(value).replaceAll("-"," ");
export function TechnicalStudiesPanel({engine,application,catalogs,renderingEngine,publishingEngine,accessibilityIdPrefix}){
    const reactId=useId(),id=accessibilityIdPrefix??reactId;
    const [draft,setDraft]=useState({studyId:"full-daily-technical-study",keyScope:"selected-key",keyTraversal:"canonical",root:"C",octaves:2,startingOctave:4,direction:"ascending-descending",measuresPerSystem:4,duration:{numerator:1,denominator:8},clef:"treble",timeSignature:{beats:4,beatUnit:4},keySignaturePolicy:"exercise-root",progression:"ii-v-i-major",realization:"blocked",harmonicRhythm:"one-per-measure",annotationPolicy:"both"});
    const [revision,setRevision]=useState(0),[state,setState]=useState({busy:false,result:null,resultRevision:null,error:null}),operation=useRef(0);
    const estimate=(()=>{try{return engine.estimate(draft);}catch{return null;}})();
    const change=patch=>{setDraft(value=>({...value,...patch}));setRevision(value=>value+1);operation.current+=1;};
    const generate=async()=>{const token=++operation.current,current=revision;setState(value=>({...value,busy:true,error:null}));try{const expansion=engine.expand(draft),result=await Promise.resolve(application.run(expansion.exerciseSetRequest));if(token===operation.current)setState({busy:false,result,resultRevision:current,error:null});}catch(error){if(token===operation.current)setState(value=>({...value,busy:false,error}));}};
    const stale=state.result&&state.resultRevision!==revision,controls=catalogs.studyControls;
    return <section className="technical-studies" aria-labelledby={`${id}-title`}>
        <header><p className="eyebrow">v9.1 · Technical studies</p><h2 id={`${id}-title`}>Taffanel-style daily studies</h2><p>Generate independent comprehensive studies through the active Core catalogs.</p></header>
        <fieldset><legend>Study selection</legend>
            <label>Study<select aria-label="Technical study" value={draft.studyId} onChange={event=>change({studyId:event.target.value})}>{catalogs.studies.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
            <label>Key scope<select aria-label="Study key scope" value={draft.keyScope} onChange={event=>change({keyScope:event.target.value})}>{controls.keyScopes.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>
            {draft.keyScope==="selected-key"?<label>Root<select aria-label="Study root" value={draft.root} onChange={event=>change({root:event.target.value})}>{controls.roots.map(value=><option key={value}>{value}</option>)}</select></label>:<label>Key traversal<select aria-label="Study key traversal" value={draft.keyTraversal} onChange={event=>change({keyTraversal:event.target.value})}>{controls.keyTraversals.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>}
            <label>Octaves<select aria-label="Study octaves" value={draft.octaves} onChange={event=>change({octaves:Number(event.target.value)})}>{[1,2,3,4].map(value=><option key={value}>{value}</option>)}</select></label>
            <label>Starting octave<select aria-label="Study starting octave" value={draft.startingOctave} onChange={event=>change({startingOctave:Number(event.target.value)})}>{[2,3,4,5,6].map(value=><option key={value}>{value}</option>)}</select></label>
            <label>Direction<select aria-label="Study direction" value={draft.direction} onChange={event=>change({direction:event.target.value})}>{["ascending","descending","ascending-descending"].map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label>Measures per system<select aria-label="Study measures per system" value={draft.measuresPerSystem} onChange={event=>change({measuresPerSystem:Number(event.target.value)})}>{controls.measuresPerSystem.map(value=><option key={value}>{value}</option>)}</select></label>
            <label>Progression<select aria-label="Study progression" value={draft.progression} onChange={event=>change({progression:event.target.value})}>{catalogs.progressions.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
            <label>Realization<select aria-label="Progression realization" value={draft.realization} onChange={event=>change({realization:event.target.value})}>{controls.realizations.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label>Harmonic rhythm<select aria-label="Study harmonic rhythm" value={draft.harmonicRhythm} onChange={event=>change({harmonicRhythm:event.target.value})}>{controls.harmonicRhythms.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label>Annotations<select aria-label="Study annotations" value={draft.annotationPolicy} onChange={event=>change({annotationPolicy:event.target.value})}>{controls.annotationPolicies.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>
        </fieldset>
        <p aria-live="polite">{estimate?`${estimate.keyCount} keys · ${estimate.sectionCount} sections · ${estimate.itemCount} exercises · about ${estimate.estimatedPages} pages · ${estimate.fitsCapacity?"fits capacity":"exceeds capacity"}`:"Study options are invalid."}</p>
        <button type="button" className="primary-action" disabled={state.busy||!estimate?.fitsCapacity} onClick={()=>void generate()}>{state.busy?"Generating…":"Generate technical study"}</button>
        {state.error&&<p role="alert">{state.error.message}</p>}{stale&&<p role="status">The retained technical study is stale.</p>}
        {state.result&&<section aria-label="Completed technical study"><h3>{state.result.document.title}</h3>{state.result.document.sections.flatMap(section=>section.items).flatMap(item=>item.presentation.rows).map(row=><ResponsiveNotation key={row.id} row={row} renderingEngine={renderingEngine} accessibilityIdPrefix={`${id}-${row.id}`}/>)}{publishingEngine&&<PublishingPanel engine={publishingEngine} source={state.result}/>}</section>}
    </section>;
}
export default TechnicalStudiesPanel;
