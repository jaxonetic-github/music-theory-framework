import { ValidationError } from "../Foundation/index.js";
import { ExerciseRequest } from "../Exercise/index.js";
import { ExerciseApplicationRequest } from "../ExerciseApplication/index.js";
import { boundedExerciseSetId, EXERCISE_SET_LIMITS, ExerciseSetRequest } from "../ExerciseSet/index.js";
import { builtInStudies } from "./builtins.js";
import { KEY_TRAVERSAL_ROOTS, StudyEstimate, StudyExpansion, StudyRequest } from "./values.js";

function exerciseFor(spec,request,root,progression){return new ExerciseRequest({type:spec.family,root,octaves:request.octaves,startingOctave:request.startingOctave,direction:["approach-note","enclosure","chord-progression"].includes(spec.family)?"ascending":request.direction,...(spec.pattern?{pattern:spec.pattern}:{}),...(spec.quality?{quality:spec.quality}:{}),...(progression?{progression,realization:request.realization,harmonicRhythm:request.harmonicRhythm,annotationPolicy:request.annotationPolicy}:{}),...(spec.target?{target:spec.target}:{}),...(spec.approachPattern?{approachPattern:spec.approachPattern}:{}),...(spec.enclosurePattern?{enclosurePattern:spec.enclosurePattern}:{})});}

export class StudyEngine {
    constructor({studies=builtInStudies,scaleCatalog,chordCatalog,progressionCatalog,exerciseEngine}={}){if(!Array.isArray(studies)||!scaleCatalog?.get||!chordCatalog?.get||!progressionCatalog?.get||!exerciseEngine?.generate)throw new ValidationError("StudyEngine requires immutable studies and active Theory, Exercise, and progression services.");this.studies=Object.freeze([...studies].sort((a,b)=>a.id.localeCompare(b.id)));this.scaleCatalog=scaleCatalog;this.chordCatalog=chordCatalog;this.progressionCatalog=progressionCatalog;this.exerciseEngine=exerciseEngine;Object.freeze(this);}
    definition(id){const value=this.studies.find(entry=>entry.id===String(id));if(!value)throw new ValidationError(`Study "${id}" was not found.`);return value;}
    roots(request){return Object.freeze(request.keyScope==="selected-key"?[request.root]:[...KEY_TRAVERSAL_ROOTS[request.keyTraversal]]);}
    estimate(input){const request=StudyRequest.from(input),definition=this.definition(request.studyId),roots=this.roots(request),keyCount=roots.length,sectionCount=definition.exercises.length,itemCount=sectionCount*keyCount,estimatedSystems=itemCount,estimatedPages=Math.ceil(estimatedSystems/4),fitsCapacity=sectionCount<=EXERCISE_SET_LIMITS.sections&&keyCount<=EXERCISE_SET_LIMITS.itemsPerSection&&itemCount<=EXERCISE_SET_LIMITS.totalItems;if(fitsCapacity)this.#preflight(definition,request,roots);return new StudyEstimate({keyCount,sectionCount,itemCount,estimatedSystems,estimatedPages,fitsCapacity});}
    #preflight(definition,request,roots){definition.exercises.forEach((spec,sectionIndex)=>{if(spec.pattern)this.scaleCatalog.get(spec.pattern,{required:true});if(spec.quality)this.chordCatalog.get(spec.quality,{required:true});const progression=spec.progressionFromRequest?request.progression:spec.progression;if(progression)this.progressionCatalog.get(progression,{required:true});roots.forEach((root,keyIndex)=>{const exercise=exerciseFor(spec,request,root,progression);try{this.exerciseEngine.generate(exercise);}catch(cause){throw new ValidationError(`Study "${definition.id}" preflight failed for section ${sectionIndex+1} (${spec.family}), key ${keyIndex+1} (${root}), starting octave ${request.startingOctave}, and ${request.octaves}-octave span: ${cause.message}`,{cause});}});});}
    expand(input){
        const request=StudyRequest.from(input),definition=this.definition(request.studyId),roots=this.roots(request),estimate=this.estimate(request);
        if(!estimate.fitsCapacity)throw new ValidationError(`Study "${definition.id}" requires ${estimate.sectionCount} sections and ${estimate.itemCount} items; ExerciseSet supports ${EXERCISE_SET_LIMITS.sections} sections, ${EXERCISE_SET_LIMITS.itemsPerSection} items per section, and ${EXERCISE_SET_LIMITS.totalItems} total items.`);
        const base={studyId:definition.id,studyVersion:definition.version,keyScope:request.keyScope,keyTraversal:request.keyTraversal,octaves:request.octaves,startingOctave:request.startingOctave,direction:request.direction,measuresPerSystem:request.measuresPerSystem,duration:request.duration,clef:request.clef,timeSignature:request.timeSignature,keySignaturePolicy:request.keySignaturePolicy,progression:request.progression,realization:request.realization,harmonicRhythm:request.harmonicRhythm,annotationPolicy:request.annotationPolicy};
        const setId=boundedExerciseSetId({kind:"study-set",readable:definition.id,identity:base});
        const sections=definition.exercises.map((spec,sectionIndex)=>{
            if(spec.pattern)this.scaleCatalog.get(spec.pattern,{required:true});if(spec.quality)this.chordCatalog.get(spec.quality,{required:true});const progression=spec.progressionFromRequest?request.progression:spec.progression;if(progression)this.progressionCatalog.get(progression,{required:true});
            const sectionId=boundedExerciseSetId({kind:"study-section",readable:`${definition.id}-${spec.family}`,identity:{...base,spec,sectionIndex}});
            return{id:sectionId,title:`${spec.pattern??spec.quality??progression??spec.family} ${spec.family}`,metadata:{...base,studySectionIndex:sectionIndex+1,family:spec.family},items:roots.map((root,keyIndex)=>{
                const exercise=exerciseFor(spec,request,root,progression);
                const trace={...base,root,keyIndex:keyIndex+1,family:spec.family,progression:progression??null};const itemId=boundedExerciseSetId({kind:"study-item",readable:`${root}-${spec.family}`,identity:{...trace,sectionIndex}});
                return{id:itemId,label:`${root} ${spec.pattern??spec.quality??progression??spec.family}`,metadata:trace,application:new ExerciseApplicationRequest({exercise,notation:{duration:request.duration,clef:request.clef,timeSignature:request.timeSignature,measuresPerSystem:request.measuresPerSystem,keySignaturePolicy:request.keySignaturePolicy},rendering:{format:"svg",options:{layoutProfile:"print-worksheet"}}})};
            })};
        });
        const exerciseSetRequest=new ExerciseSetRequest({id:setId,title:definition.name,subtitle:definition.description,instructions:`${request.octaves} octaves · ${request.keyScope} · ${request.keyTraversal}`,sections});
        return new StudyExpansion({request,definition,estimate,exerciseSetRequest,metadata:{...base,roots,generatedExerciseSetId:setId}});
    }
}
