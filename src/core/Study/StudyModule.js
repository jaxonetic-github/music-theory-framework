import { ValidationError } from "../Foundation/index.js";
import { builtInStudies } from "./builtins.js";
import { studyExpansionDescriptor, studyPluginDescriptor, studyServiceDescriptor } from "./descriptors.js";
import { StudyEngine } from "./StudyEngine.js";
import { studyPackageDescriptor } from "./package.descriptor.js";

const undoAll = actions => { const errors=[]; for (const action of [...actions].reverse()) try { action(); } catch(error) { errors.push(error); } return errors; };
export class StudyModule {
    #configured=false; #undo=[];
    constructor(){this.id=String(studyPackageDescriptor.id);this.descriptor=studyPackageDescriptor;this.engine=null;this.plugin=null;Object.seal(this);}
    configure({services,registries}) {
        if(this.#configured)return this;
        let scaleCatalog,chordCatalog,progressionCatalog;
        try { scaleCatalog=services.resolve("theory.scaleCatalog");chordCatalog=services.resolve("theory.chordCatalog");progressionCatalog=services.resolve("exercise.progressionCatalog"); }
        catch(cause){throw new ValidationError("StudyModule requires active Theory and progression catalogs.",{cause});}
        const engine=new StudyEngine({scaleCatalog,chordCatalog,progressionCatalog});
        const plugin=Object.freeze({id:String(studyPluginDescriptor.id),studies:builtInStudies});
        const undo=[];
        const service=(id,value)=>{services.register(id,value);undo.push(()=>{if(services.resolve(id,{optional:true})===value)services.unregister(id);});};
        const record=(registry,descriptor,value)=>{let inserted=null;const remove=current=>{if(registry.getRecord(descriptor.id)===current)registry.unregister(descriptor.id);};try{inserted=registry.register(descriptor,{value});}catch(error){const current=registry.getRecord(descriptor.id);if(current?.descriptor===descriptor&&current?.value===value)try{remove(current);}catch{}throw error;}undo.push(()=>remove(inserted));};
        try { service("study.engine",engine);record(registries.services,studyServiceDescriptor,engine);record(registries.plugins,studyPluginDescriptor,plugin);record(registries.exercises,studyExpansionDescriptor,engine);this.engine=engine;this.plugin=plugin;this.#undo=undo;this.#configured=true;return this; }
        catch(error){const failures=undoAll(undo);if(failures.length)throw new AggregateError([error,...failures],"StudyModule configuration and rollback failed.",{cause:error});throw error;}
    }
    dispose(){const errors=undoAll(this.#undo);this.#undo=[];this.#configured=false;this.engine=null;this.plugin=null;if(errors.length)throw new AggregateError(errors,"StudyModule disposal failed.");return this;}
}
