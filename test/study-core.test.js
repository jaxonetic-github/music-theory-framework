import test from "node:test";
import assert from "node:assert/strict";
import { ExerciseApplicationModule, ExerciseModule, ExerciseNotationModule, ExerciseSetModule, Kernel, LayoutModule, NotationModule, RenderingModule, Study, StudyModule, StudyRequest, TheoryModule, ValidationError } from "../src/core/index.js";

async function fixture(){const kernel=new Kernel().use(new TheoryModule()).use(new ExerciseModule()).use(new StudyModule());await kernel.start();return{kernel,engine:kernel.services.resolve("study.engine"),exercise:kernel.services.resolve("exercise.engine")};}
async function applicationFixture(){const layout=new LayoutModule(),kernel=new Kernel().use(new TheoryModule()).use(new NotationModule()).use(layout).use(new RenderingModule({layoutEngine:layout.engine})).use(new ExerciseModule()).use(new ExerciseNotationModule()).use(new ExerciseApplicationModule()).use(new ExerciseSetModule()).use(new StudyModule());await kernel.start();return{kernel,study:kernel.services.resolve("study.engine"),application:kernel.services.resolve("exercise.set.application")};}

test("study requests use the strict two-octave default and immutable public controls",()=>{
    const value=new StudyRequest();assert.equal(value.octaves,2);assert.equal(value.keySignaturePolicy,"none");assert.ok(Object.isFrozen(value));
    for(const octaves of [1,2,3,4])assert.equal(new StudyRequest({octaves}).octaves,octaves);
    for(const octaves of [0,5,1.5,"2",NaN,Infinity])assert.throws(()=>new StudyRequest({octaves}),ValidationError);
    assert.deepEqual(Study.STUDY_MEASURES_PER_SYSTEM,[1,2,4,8,16]);
    assert.throws(()=>new StudyRequest({measuresPerSystem:3}),/1, 2, 4, 8, or 16/);
});

test("foundational scale generation covers one through four exact octaves without truncation",async()=>{
    const {kernel,exercise,engine}=await fixture();try{for(const octaves of [1,2,3,4]){const row=exercise.generate({type:"scale",root:"C",octaves}).rows[0];assert.equal(row.writtenPitches.length,octaves*7+1);assert.equal(row.writtenPitches.at(-1),`C${4+octaves}`);}assert.throws(()=>exercise.generate({type:"scale",root:"B#",octaves:4,startingOctave:8}),/MIDI range/);assert.throws(()=>engine.expand({studyId:"daily-scale-studies",root:"B#",octaves:4,startingOctave:8}),/offending written register endpoint/);}finally{await kernel.dispose();}
});

test("key scope and traversal are separate, deterministic, and use the documented F-sharp cycle spelling",async()=>{
    const {kernel,engine}=await fixture();try{
        assert.deepEqual(engine.roots(new StudyRequest({keyScope:"selected-key",root:"Cb",keyTraversal:"cycle-of-fifths"})),["Cb"]);
        assert.deepEqual(engine.roots(new StudyRequest({keyScope:"all-keys",keyTraversal:"cycle-of-fifths"})),["C","G","D","A","E","B","F#","Db","Ab","Eb","Bb","F"]);
        assert.deepEqual(engine.roots(new StudyRequest({keyScope:"all-keys",keyTraversal:"chromatic"})),["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]);
    }finally{await kernel.dispose();}
});

test("study preflight and expansion produce bounded immutable ExerciseSet requests with complete trace",async()=>{
    const {kernel,engine}=await fixture();try{
        const request=new StudyRequest({studyId:"full-daily-technical-study",keyScope:"all-keys",keyTraversal:"cycle-of-fifths"});
        const estimate=engine.estimate(request);assert.deepEqual({keys:estimate.keyCount,sections:estimate.sectionCount,items:estimate.itemCount,fit:estimate.fitsCapacity},{keys:12,sections:12,items:144,fit:true});
        const first=engine.expand(request),second=engine.expand(request);assert.deepEqual(first,second);assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.exerciseSetRequest));
        assert.equal(first.exerciseSetRequest.sections.length,12);assert.equal(first.exerciseSetRequest.sections[0].items.length,12);
        assert.equal(first.exerciseSetRequest.sections[0].items[6].metadata.root,"F#");assert.equal(first.exerciseSetRequest.sections[0].items[6].metadata.octaves,2);
        assert.ok(first.exerciseSetRequest.sections.every(section=>section.items.every(item=>item.id.length<=160)));
    }finally{await kernel.dispose();}
});

test("the default full daily study executes through ExerciseSetApplication with conservative signatures",async()=>{
    const {kernel,study,application}=await applicationFixture();try{const expansion=study.expand(new StudyRequest());assert.ok(expansion.exerciseSetRequest.items.every(item=>item.application.notation.keySignaturePolicy==="none"));const result=application.run(expansion.exerciseSetRequest);assert.equal(result.document.sections.length,12);assert.equal(result.document.sections.flatMap(section=>section.items).length,12);assert.ok(result.document.sections.flatMap(section=>section.items).every(item=>item.presentation.rows.every(row=>row.content.startsWith("<svg"))));}finally{await kernel.dispose();}
});

test("StudyModule is reusable and leaves no owned service registrations",async()=>{
    const kernel=new Kernel().use(new TheoryModule()).use(new ExerciseModule()),module=new StudyModule();kernel.use(module);await kernel.start();assert.ok(kernel.services.resolve("study.engine"));await kernel.dispose();assert.equal(kernel.services.resolve("study.engine",{optional:true}),null);assert.equal(String(Study.descriptor.version),"9.1.0");
});

test("progression realizations are generated semantically in Core with deterministic metadata",async()=>{
    const {kernel,exercise}=await fixture();try{
        for(const realization of ["blocked","broken","arpeggiated","guide-tones","voice-led"]){const request={type:"chord-progression",root:"C",progression:"ii-v-i-major",octaves:2,realization,annotationPolicy:"roman-numerals",harmonicRhythm:"one-per-measure"};const first=exercise.generate(request),second=exercise.generate(request);assert.deepEqual(first,second);const steps=first.rows[0].steps;assert.equal(steps[0].metadata.realization,realization);assert.equal(steps[0].metadata.romanNumeral,"ii7");if(["broken","arpeggiated"].includes(realization))assert.equal(steps[0].simultaneous,false);else assert.equal(steps[0].simultaneous,true);if(realization==="guide-tones")assert.deepEqual(steps[0].chordMembers,[3,7]);}
        assert.throws(()=>new StudyRequest({realization:"imaginary"}),/realization/);
    }finally{await kernel.dispose();}
});
