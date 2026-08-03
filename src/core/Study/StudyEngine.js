import { ValidationError } from "../Foundation/index.js";
import { ExerciseRequest } from "../Exercise/index.js";
import { ExerciseApplicationRequest } from "../ExerciseApplication/index.js";
import { boundedExerciseSetId, EXERCISE_SET_LIMITS, ExerciseSetRequest } from "../ExerciseSet/index.js";
import { builtInStudies } from "./builtins.js";
import { KEY_TRAVERSAL_ROOTS, StudyEstimate, StudyExpansion, StudyRequest } from "./values.js";
import { Note } from "../Theory/index.js";

export class StudyEngine {
    constructor({studies=builtInStudies,scaleCatalog,chordCatalog,progressionCatalog}={}){if(!Array.isArray(studies)||!scaleCatalog?.get||!chordCatalog?.get||!progressionCatalog?.get)throw new ValidationError("StudyEngine requires immutable studies and active Theory/progression catalogs.");this.studies=Object.freeze([...studies].sort((a,b)=>a.id.localeCompare(b.id)));this.scaleCatalog=scaleCatalog;this.chordCatalog=chordCatalog;this.progressionCatalog=progressionCatalog;Object.freeze(this);}
    definition(id){const value=this.studies.find(entry=>entry.id===String(id));if(!value)throw new ValidationError(`Study "${id}" was not found.`);return value;}
    roots(request){return Object.freeze(request.keyScope==="selected-key"?[request.root]:[...KEY_TRAVERSAL_ROOTS[request.keyTraversal]]);}
    estimate(input){const request=StudyRequest.from(input),definition=this.definition(request.studyId),keyCount=this.roots(request).length,sectionCount=definition.exercises.length,itemCount=sectionCount*keyCount,estimatedSystems=itemCount,estimatedPages=Math.ceil(estimatedSystems/4),fitsCapacity=sectionCount<=EXERCISE_SET_LIMITS.sections&&keyCount<=EXERCISE_SET_LIMITS.itemsPerSection&&itemCount<=EXERCISE_SET_LIMITS.totalItems;return new StudyEstimate({keyCount,sectionCount,itemCount,estimatedSystems,estimatedPages,fitsCapacity});}
    expand(input){
        const request=StudyRequest.from(input),definition=this.definition(request.studyId),roots=this.roots(request),estimate=this.estimate(request);
        if(!estimate.fitsCapacity)throw new ValidationError(`Study "${definition.id}" requires ${estimate.sectionCount} sections and ${estimate.itemCount} items; ExerciseSet supports ${EXERCISE_SET_LIMITS.sections} sections, ${EXERCISE_SET_LIMITS.itemsPerSection} items per section, and ${EXERCISE_SET_LIMITS.totalItems} total items.`);
        for(const root of roots)try{new Note(root,request.startingOctave);new Note(root,request.startingOctave+request.octaves);}catch(cause){throw new ValidationError(`Study "${definition.id}" cannot span ${request.octaves} octaves from ${root}${request.startingOctave}; offending written register endpoint ${root}${request.startingOctave+request.octaves}.`,{cause});}
        const base={studyId:definition.id,studyVersion:definition.version,keyScope:request.keyScope,keyTraversal:request.keyTraversal,octaves:request.octaves,startingOctave:request.startingOctave,direction:request.direction,measuresPerSystem:request.measuresPerSystem,duration:request.duration,clef:request.clef,timeSignature:request.timeSignature,keySignaturePolicy:request.keySignaturePolicy,progression:request.progression,realization:request.realization,harmonicRhythm:request.harmonicRhythm,annotationPolicy:request.annotationPolicy};
        const setId=boundedExerciseSetId({kind:"study-set",readable:definition.id,identity:base});
        const sections=definition.exercises.map((spec,sectionIndex)=>{
            if(spec.pattern)this.scaleCatalog.get(spec.pattern,{required:true});if(spec.quality)this.chordCatalog.get(spec.quality,{required:true});const progression=spec.progressionFromRequest?request.progression:spec.progression;if(progression)this.progressionCatalog.get(progression,{required:true});
            const sectionId=boundedExerciseSetId({kind:"study-section",readable:`${definition.id}-${spec.family}`,identity:{...base,spec,sectionIndex}});
            return{id:sectionId,title:`${spec.pattern??spec.quality??progression??spec.family} ${spec.family}`,metadata:{...base,studySectionIndex:sectionIndex+1,family:spec.family},items:roots.map((root,keyIndex)=>{
                const exercise={type:spec.family,root,octaves:request.octaves,startingOctave:request.startingOctave,direction:["approach-note","enclosure","chord-progression"].includes(spec.family)?"ascending":request.direction,...(spec.pattern?{pattern:spec.pattern}:{}),...(spec.quality?{quality:spec.quality}:{}),...(progression?{progression,realization:request.realization,harmonicRhythm:request.harmonicRhythm,annotationPolicy:request.annotationPolicy}:{}),...(spec.target?{target:spec.target}:{}),...(spec.approachPattern?{approachPattern:spec.approachPattern}:{}),...(spec.enclosurePattern?{enclosurePattern:spec.enclosurePattern}:{})};
                new ExerciseRequest(exercise);const trace={...base,root,keyIndex:keyIndex+1,family:spec.family,progression:progression??null};const itemId=boundedExerciseSetId({kind:"study-item",readable:`${root}-${spec.family}`,identity:{...trace,sectionIndex}});
                return{id:itemId,label:`${root} ${spec.pattern??spec.quality??progression??spec.family}`,metadata:trace,application:new ExerciseApplicationRequest({exercise,notation:{duration:request.duration,clef:request.clef,timeSignature:request.timeSignature,measuresPerSystem:request.measuresPerSystem,keySignaturePolicy:request.keySignaturePolicy},rendering:{format:"svg",options:{layoutProfile:"print-worksheet"}}})};
            })};
        });
        const exerciseSetRequest=new ExerciseSetRequest({id:setId,title:definition.name,subtitle:definition.description,instructions:`${request.octaves} octaves · ${request.keyScope} · ${request.keyTraversal}`,sections});
        return new StudyExpansion({request,definition,estimate,exerciseSetRequest,metadata:{...base,roots,generatedExerciseSetId:setId}});
    }
}
