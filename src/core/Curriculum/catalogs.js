import { ValidationError } from "../Foundation/index.js";
import { Curriculum, ExerciseTemplate } from "./values.js";

class PluginCatalog {
    #plugins=new Map(); #listeners=new Set(); #Type; #label;
    constructor(Type,label){this.#Type=Type;this.#label=label;Object.seal(this);}
    #notify(event){for(const listener of this.#listeners)listener(Object.freeze(event));}
    subscribe(listener){if(typeof listener!=="function")throw new TypeError(`${this.#label} catalog listener must be a function.`);this.#listeners.add(listener);return()=>this.#listeners.delete(listener);}
    register(pluginId,value,{replace=false}={}){const plugin=String(pluginId),normalized=value instanceof this.#Type?value:new this.#Type(value),map=this.#plugins.get(plugin)??new Map(),existing=map.get(normalized.id);if(existing===normalized)return normalized;if(existing&&!replace)throw new ValidationError(`${this.#label} "${normalized.id}" is already registered for plugin "${plugin}".`);map.set(normalized.id,normalized);this.#plugins.set(plugin,map);try{this.#notify({type:existing?"replaced":"registered",pluginId:plugin,id:normalized.id,value:normalized,previous:existing??null});}catch(error){if(existing)map.set(normalized.id,existing);else{map.delete(normalized.id);if(!map.size)this.#plugins.delete(plugin);}throw error;}return normalized;}
    get(pluginId,id,{required=false}={}){const value=this.#plugins.get(String(pluginId))?.get(String(id))??null;if(!value&&required)throw new ValidationError(`${this.#label} "${String(id)}" was not found for plugin "${String(pluginId)}".`);return value;}
    remove(pluginId,id){const plugin=String(pluginId),key=String(id),map=this.#plugins.get(plugin);if(!map)return null;const value=map.get(key)??null;if(!value)return null;map.delete(key);if(!map.size)this.#plugins.delete(plugin);try{this.#notify({type:"removed",pluginId:plugin,id:key,value});}catch(error){map.set(key,value);this.#plugins.set(plugin,map);throw error;}return value;}
    restore(pluginId,value){return this.register(pluginId,value,{replace:true});}
    values(pluginId=null){const values=pluginId===null?[...this.#plugins.values()].flatMap(map=>[...map.values()]):[...(this.#plugins.get(String(pluginId))?.values()??[])];return Object.freeze(values.sort((a,b)=>a.id.localeCompare(b.id)));}
    entries(pluginId=null){const records=pluginId===null?[...this.#plugins].flatMap(([scope,map])=>[...map.values()].map(value=>({pluginId:scope,value}))):[...(this.#plugins.get(String(pluginId))?.values()??[])].map(value=>({pluginId:String(pluginId),value}));return Object.freeze(records.sort((a,b)=>a.pluginId.localeCompare(b.pluginId)||a.value.id.localeCompare(b.value.id)).map(record=>Object.freeze(record)));}
    snapshot(pluginId=null){return Object.freeze({pluginId:pluginId===null?null:String(pluginId),entries:this.entries(pluginId),values:this.values(pluginId)});}
}
export class ExerciseTemplateCatalog extends PluginCatalog { constructor(){super(ExerciseTemplate,"Exercise template");} }
export class CurriculumCatalog extends PluginCatalog {
    #templates;
    constructor(templateCatalog){super(Curriculum,"Curriculum");this.#templates=templateCatalog;}
    register(pluginId,value,options={}){const curriculum=value instanceof Curriculum?value:new Curriculum(value),scope=String(pluginId);for(const unit of curriculum.units)for(const lesson of unit.lessons)for(const reference of lesson.templates){const templateScope=reference.pluginId??scope;try{this.#templates.get(templateScope,reference.templateId,{required:true});}catch(cause){throw new ValidationError(`Curriculum "${curriculum.id}" unit "${unit.id}" lesson "${lesson.id}" cannot resolve template "${templateScope}:${reference.templateId}".`,{cause});}}const all=[...this.values(scope).filter(entry=>entry.id!==curriculum.id),curriculum],ids=new Set(all.map(entry=>entry.id));const visit=(entry,trail=[])=>{if(trail.includes(entry.id))throw new ValidationError(`Curriculum prerequisites contain a cycle at "${entry.id}".`);for(const dependency of entry.prerequisites){if(!ids.has(dependency))throw new ValidationError(`Curriculum "${entry.id}" references missing prerequisite "${dependency}".`);visit(all.find(candidate=>candidate.id===dependency),[...trail,entry.id]);}};all.forEach(entry=>visit(entry));return super.register(scope,curriculum,options);}
}
