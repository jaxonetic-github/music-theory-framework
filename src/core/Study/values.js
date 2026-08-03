import { cloneDeep, freezeDeep, Identifier, ValidationError } from "../Foundation/index.js";
import { ExerciseSetRequest } from "../ExerciseSet/index.js";
import { PitchClass } from "../Theory/index.js";

export const KEY_SCOPES=Object.freeze(["selected-key","all-keys"]);
export const KEY_TRAVERSALS=Object.freeze(["canonical","chromatic","cycle-of-fifths"]);
export const KEY_TRAVERSAL_ROOTS=Object.freeze({canonical:Object.freeze(["C","Db","D","Eb","E","F","F#","G","Ab","A","Bb","B"]),chromatic:Object.freeze(["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]),"cycle-of-fifths":Object.freeze(["C","G","D","A","E","B","F#","Db","Ab","Eb","Bb","F"])});
export const PROGRESSION_REALIZATIONS=Object.freeze(["blocked","broken","arpeggiated","guide-tones","voice-led"]);
export const HARMONIC_RHYTHMS=Object.freeze(["one-per-measure","two-per-measure"]);
export const ANNOTATION_POLICIES=Object.freeze(["chord-symbols","roman-numerals","both","none"]);
export const STUDY_MEASURES_PER_SYSTEM=Object.freeze([1,2,4,8,16]);
const choice=(value,allowed,label)=>{const normalized=String(value);if(!allowed.includes(normalized))throw new ValidationError(`${label} must be one of: ${allowed.join(", ")}.`);return normalized;};
const immutable=value=>freezeDeep(cloneDeep(value));

export class StudyDefinition {
    constructor({id,name,description,version="1.0.0",tags=[],exercises=[]}={}){const normalizedId=String(Identifier.from(id));if(!name||!description||!Array.isArray(exercises)||!exercises.length||exercises.length>32)throw new ValidationError(`Study definition "${normalizedId}" is malformed.`);Object.assign(this,{id:normalizedId,name:String(name),description:String(description),version:String(version),tags:Object.freeze(tags.map(String)),exercises:immutable(exercises)});Object.freeze(this);}
}
export class StudyRequest {
    constructor({studyId="full-daily-technical-study",keyScope="selected-key",keyTraversal="canonical",root="C",octaves=2,startingOctave=4,direction="ascending-descending",measuresPerSystem=4,duration={numerator:1,denominator:8},clef="treble",timeSignature={beats:4,beatUnit:4},keySignaturePolicy="none",progression="ii-v-i-major",realization="blocked",harmonicRhythm="one-per-measure",annotationPolicy="both"}={}){
        studyId=String(Identifier.from(studyId));keyScope=choice(keyScope,KEY_SCOPES,"Study key scope");keyTraversal=choice(keyTraversal,KEY_TRAVERSALS,"Study key traversal");root=String(PitchClass.from(root));
        if(!Number.isSafeInteger(octaves)||octaves<1||octaves>4)throw new ValidationError("Study octaves must be an integer from 1 through 4.");
        if(!Number.isSafeInteger(startingOctave)||startingOctave< -1||startingOctave>9)throw new ValidationError("Study starting octave must be an integer from -1 through 9.");
        if(!["ascending","descending","ascending-descending"].includes(String(direction)))throw new ValidationError("Study direction must be ascending, descending, or ascending-descending.");
        if(!STUDY_MEASURES_PER_SYSTEM.includes(measuresPerSystem))throw new ValidationError("Study measures per system must be 1, 2, 4, 8, or 16.");
        realization=choice(realization,PROGRESSION_REALIZATIONS,"Progression realization");harmonicRhythm=choice(harmonicRhythm,HARMONIC_RHYTHMS,"Harmonic rhythm");annotationPolicy=choice(annotationPolicy,ANNOTATION_POLICIES,"Annotation policy");
        Object.assign(this,{studyId,keyScope,keyTraversal,root,octaves,startingOctave,direction:String(direction),measuresPerSystem,duration:immutable(duration),clef:String(clef),timeSignature:immutable(timeSignature),keySignaturePolicy:String(keySignaturePolicy),progression:String(progression),realization,harmonicRhythm,annotationPolicy});Object.freeze(this);
    }
    static from(value){return value instanceof this?value:new this(value);}
}
export class StudyEstimate{constructor({keyCount,sectionCount,itemCount,estimatedSystems,estimatedPages,fitsCapacity}={}){Object.assign(this,{keyCount,sectionCount,itemCount,estimatedSystems,estimatedPages,fitsCapacity});Object.freeze(this);}}
export class StudyExpansion{constructor({request,definition,estimate,exerciseSetRequest,metadata}={}){if(!(request instanceof StudyRequest)||!(definition instanceof StudyDefinition)||!(estimate instanceof StudyEstimate)||!(exerciseSetRequest instanceof ExerciseSetRequest))throw new ValidationError("Invalid study expansion.");Object.assign(this,{id:exerciseSetRequest.id,request,definition,estimate,exerciseSetRequest,metadata:immutable(metadata)});Object.freeze(this);}}
