import { canonicalSerialize, cloneDeep, freezeDeep, Identifier, ValidationError } from "../Foundation/index.js";
import { ExerciseType } from "../Exercise/index.js";

export const CURRICULUM_LIMITS = Object.freeze({ templates: 128, units: 24, lessonsPerUnit: 24, referencesPerLesson: 32, parameters: 32, text: 1000 });
const difficultyOrder = Object.freeze({ beginner: 1, intermediate: 2, advanced: 3 });
const text = (value, label, required = true) => { const result = String(value ?? "").trim(); if ((required && !result) || result.length > CURRICULUM_LIMITS.text) throw new ValidationError(`${label} must be ${required ? "a non-empty " : ""}text of at most ${CURRICULUM_LIMITS.text} characters.`); return result || null; };
const id = (value, label) => { try { return String(Identifier.from(value)); } catch (cause) { throw new ValidationError(`Invalid ${label}: ${cause.message}`, { cause }); } };
const list = (value, label) => { if (value === undefined) return Object.freeze([]); if (!Array.isArray(value)) throw new ValidationError(`${label} must be an ordered array.`); return Object.freeze(value.map((entry, index) => text(entry, `${label} entry ${index + 1}`))); };
const immutable = value => freezeDeep(cloneDeep(value ?? {}));

export class DifficultyLevel {
    constructor(value = "beginner") { if (value instanceof DifficultyLevel) return value; const normalized = String(value).trim().toLowerCase(); if (!difficultyOrder[normalized]) throw new ValidationError(`Unknown difficulty level: "${String(value)}".`); Object.defineProperties(this,{ value:{value:normalized,enumerable:true}, rank:{value:difficultyOrder[normalized],enumerable:true} }); Object.freeze(this); }
    static from(value) { return value instanceof DifficultyLevel ? value : new DifficultyLevel(value); }
    compare(other) { return this.rank - DifficultyLevel.from(other).rank; }
    toString() { return this.value; } toJSON() { return this.value; }
}

export class CurriculumMetadata {
    constructor(value = {}) { if (value instanceof CurriculumMetadata) return value; if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Curriculum metadata must be an object."); try { canonicalSerialize(value); } catch (cause) { throw new ValidationError(`Curriculum metadata must be deterministic: ${cause.message}`, { cause }); } Object.assign(this, immutable(value)); Object.freeze(this); }
}

export class ExerciseTemplateParameter {
    constructor({ id: value, label, contract = "string", required = false, defaultValue, allowedValues, validationSource = null, overridable = true, helpText = null } = {}) {
        const parameterId=id(value,"template parameter id"), normalizedContract=String(contract);
        if (!["string","boolean","integer","duration","root","roots","choice","object"].includes(normalizedContract)) throw new ValidationError(`Template parameter "${parameterId}" has an unsupported contract.`);
        if (typeof required!=="boolean"||typeof overridable!=="boolean") throw new ValidationError(`Template parameter "${parameterId}" flags must be boolean.`);
        if (allowedValues !== undefined && !Array.isArray(allowedValues)) throw new ValidationError(`Template parameter "${parameterId}" allowedValues must be an ordered array.`);
        const allowed=allowedValues===undefined?null:Object.freeze(allowedValues.map(value=>immutable(value)));
        Object.defineProperties(this,{id:{value:parameterId,enumerable:true},label:{value:text(label??parameterId,"Template parameter label"),enumerable:true},contract:{value:normalizedContract,enumerable:true},required:{value:required,enumerable:true},defaultValue:{value:defaultValue===undefined?undefined:immutable(defaultValue),enumerable:true},allowedValues:{value:allowed,enumerable:true},validationSource:{value:validationSource===null?null:String(validationSource),enumerable:true},overridable:{value:overridable,enumerable:true},helpText:{value:helpText===null?null:text(helpText,"Template parameter help"),enumerable:true}}); Object.freeze(this);
    }
}

export class ExerciseTemplate {
    constructor({ id: value, name, description, family, objective, difficulty, tags=[], parameters=[], defaults={}, constraints={}, recommendedRanges={}, sectionLabel=null, itemLabel=null, instructions=null, prerequisites=[], version="1.0.0", metadata={} } = {}) {
        const templateId=id(value,"template id"), normalizedParameters=parameters.map(value=>value instanceof ExerciseTemplateParameter?value:new ExerciseTemplateParameter(value));
        if (normalizedParameters.length>CURRICULUM_LIMITS.parameters||new Set(normalizedParameters.map(value=>value.id)).size!==normalizedParameters.length) throw new ValidationError(`Template "${templateId}" has duplicate or excessive parameters.`);
        const parameterIds=new Set(normalizedParameters.map(value=>value.id)); for(const key of [...Object.keys(defaults),...Object.keys(constraints)]) if(!parameterIds.has(key)) throw new ValidationError(`Template "${templateId}" defines unknown parameter "${key}".`);
        Object.defineProperties(this,{id:{value:templateId,enumerable:true},name:{value:text(name,"Template name"),enumerable:true},description:{value:text(description,"Template description"),enumerable:true},family:{value:ExerciseType.from(family),enumerable:true},objective:{value:text(objective,"Template objective"),enumerable:true},difficulty:{value:DifficultyLevel.from(difficulty),enumerable:true},tags:{value:list(tags,"Template tags"),enumerable:true},parameters:{value:Object.freeze(normalizedParameters),enumerable:true},defaults:{value:immutable(defaults),enumerable:true},constraints:{value:immutable(constraints),enumerable:true},recommendedRanges:{value:immutable(recommendedRanges),enumerable:true},sectionLabel:{value:sectionLabel===null?null:text(sectionLabel,"Template section label"),enumerable:true},itemLabel:{value:itemLabel===null?null:text(itemLabel,"Template item label"),enumerable:true},instructions:{value:instructions===null?null:text(instructions,"Template instructions"),enumerable:true},prerequisites:{value:list(prerequisites,"Template prerequisites"),enumerable:true},version:{value:text(version,"Template version"),enumerable:true},metadata:{value:new CurriculumMetadata(metadata),enumerable:true}}); Object.freeze(this);
    }
}

export class ExerciseTemplateRequest {
    constructor({ templateId, pluginId="core.curriculum.builtins", overrides={} }={}) { Object.defineProperties(this,{templateId:{value:id(templateId,"template request id"),enumerable:true},pluginId:{value:id(pluginId,"template plugin id"),enumerable:true},overrides:{value:immutable(overrides),enumerable:true}}); Object.freeze(this); }
}

export class ExerciseTemplateExpansion {
    constructor({ template, request, parameters, exerciseSetRequest }={}) { if(!(template instanceof ExerciseTemplate)||!(request instanceof ExerciseTemplateRequest)||!exerciseSetRequest)throw new ValidationError("Invalid exercise template expansion."); Object.defineProperties(this,{template:{value:template,enumerable:true},request:{value:request,enumerable:true},parameters:{value:immutable(parameters),enumerable:true},exerciseSetRequest:{value:exerciseSetRequest,enumerable:true}}); Object.freeze(this); }
}

export class CurriculumLesson {
    constructor({ id:value,title,description="",objective,difficulty="beginner",tags=[],prerequisites=[],templates=[] }={}) { const lessonId=id(value,"lesson id");if(!Array.isArray(templates)||!templates.length||templates.length>CURRICULUM_LIMITS.referencesPerLesson)throw new ValidationError(`Lesson "${lessonId}" requires a bounded non-empty template list.`);const refs=templates.map((entry,index)=>{if(!entry||typeof entry!=="object"||Array.isArray(entry))throw new ValidationError(`Lesson "${lessonId}" template ${index+1} must be an object.`);return freezeDeep({templateId:id(entry.templateId,"template reference"),pluginId:id(entry.pluginId??"core.curriculum.builtins","template plugin reference"),overrides:cloneDeep(entry.overrides??{}),label:entry.label?text(entry.label,"template reference label"):null});});Object.defineProperties(this,{id:{value:lessonId,enumerable:true},title:{value:text(title,"Lesson title"),enumerable:true},description:{value:text(description,"Lesson description",false),enumerable:true},objective:{value:text(objective,"Lesson objective"),enumerable:true},difficulty:{value:DifficultyLevel.from(difficulty),enumerable:true},tags:{value:list(tags,"Lesson tags"),enumerable:true},prerequisites:{value:list(prerequisites,"Lesson prerequisites"),enumerable:true},templates:{value:Object.freeze(refs),enumerable:true}});Object.freeze(this); }
}

export class CurriculumUnit {
    constructor({ id:value,title,description="",objective,difficulty="beginner",tags=[],prerequisites=[],lessons=[] }={}) { const unitId=id(value,"unit id");if(!Array.isArray(lessons)||!lessons.length||lessons.length>CURRICULUM_LIMITS.lessonsPerUnit)throw new ValidationError(`Unit "${unitId}" requires a bounded non-empty lesson list.`);const normalized=lessons.map(value=>value instanceof CurriculumLesson?value:new CurriculumLesson(value));if(new Set(normalized.map(value=>value.id)).size!==normalized.length)throw new ValidationError(`Unit "${unitId}" contains duplicate lesson IDs.`);Object.defineProperties(this,{id:{value:unitId,enumerable:true},title:{value:text(title,"Unit title"),enumerable:true},description:{value:text(description,"Unit description",false),enumerable:true},objective:{value:text(objective,"Unit objective"),enumerable:true},difficulty:{value:DifficultyLevel.from(difficulty),enumerable:true},tags:{value:list(tags,"Unit tags"),enumerable:true},prerequisites:{value:list(prerequisites,"Unit prerequisites"),enumerable:true},lessons:{value:Object.freeze(normalized),enumerable:true}});Object.freeze(this); }
}

function assertAcyclic(values,label){const ids=new Set(values.map(value=>value.id)),visiting=new Set(),done=new Set();const visit=value=>{if(visiting.has(value.id))throw new ValidationError(`${label} prerequisites contain a cycle at "${value.id}".`);if(done.has(value.id))return;visiting.add(value.id);for(const dependency of value.prerequisites){if(!ids.has(dependency))throw new ValidationError(`${label} "${value.id}" references missing prerequisite "${dependency}".`);visit(values.find(entry=>entry.id===dependency));}visiting.delete(value.id);done.add(value.id);};values.forEach(visit);}
export class Curriculum {
    constructor({ id:value,title,description,version="1.0.0",objective,difficulty="beginner",tags=[],prerequisites=[],units=[],metadata={} }={}) { const curriculumId=id(value,"curriculum id");if(!Array.isArray(units)||!units.length||units.length>CURRICULUM_LIMITS.units)throw new ValidationError(`Curriculum "${curriculumId}" requires a bounded non-empty unit list.`);const normalized=units.map(value=>value instanceof CurriculumUnit?value:new CurriculumUnit(value));if(new Set(normalized.map(value=>value.id)).size!==normalized.length)throw new ValidationError(`Curriculum "${curriculumId}" contains duplicate unit IDs.`);assertAcyclic(normalized,"Unit");for(const unit of normalized)assertAcyclic(unit.lessons,"Lesson");Object.defineProperties(this,{id:{value:curriculumId,enumerable:true},title:{value:text(title,"Curriculum title"),enumerable:true},description:{value:text(description,"Curriculum description"),enumerable:true},version:{value:text(version,"Curriculum version"),enumerable:true},objective:{value:text(objective,"Curriculum objective"),enumerable:true},difficulty:{value:DifficultyLevel.from(difficulty),enumerable:true},tags:{value:list(tags,"Curriculum tags"),enumerable:true},prerequisites:{value:list(prerequisites,"Curriculum prerequisites"),enumerable:true},units:{value:Object.freeze(normalized),enumerable:true},metadata:{value:new CurriculumMetadata(metadata),enumerable:true}});Object.freeze(this); }
}

export class CurriculumExpansionRequest {
    constructor({ curriculumId, pluginId="core.curriculum.builtins", unitId=null, lessonId=null, overrides={} }={}) { Object.defineProperties(this,{curriculumId:{value:id(curriculumId,"curriculum request id"),enumerable:true},pluginId:{value:id(pluginId,"curriculum plugin id"),enumerable:true},unitId:{value:unitId===null?null:id(unitId,"unit request id"),enumerable:true},lessonId:{value:lessonId===null?null:id(lessonId,"lesson request id"),enumerable:true},overrides:{value:immutable(overrides),enumerable:true}});Object.freeze(this); }
}
export class CurriculumExpansionResult {
    constructor({ request,curriculum,exerciseSetRequest,metadata={} }={}) { if(!(request instanceof CurriculumExpansionRequest)||!(curriculum instanceof Curriculum)||!exerciseSetRequest)throw new ValidationError("Invalid curriculum expansion result.");Object.defineProperties(this,{request:{value:request,enumerable:true},curriculum:{value:curriculum,enumerable:true},exerciseSetRequest:{value:exerciseSetRequest,enumerable:true},metadata:{value:new CurriculumMetadata(metadata),enumerable:true}});Object.freeze(this); }
}
