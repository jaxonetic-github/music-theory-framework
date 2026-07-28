import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCurriculumSelection, normalizeTemplateSelection } from "../src/web/curriculum/workflow.js";

const lesson = id => Object.freeze({ id });
const unit = (id,lessons) => Object.freeze({ id,lessons:Object.freeze(lessons.map(lesson)) });
const curriculum = (key,units) => Object.freeze({ key,units:Object.freeze(units) });
const parameter = (id,defaultValue) => Object.freeze({ id,defaultValue,fixed:false });
const template = (key,parameters) => Object.freeze({ key,parameters:Object.freeze(parameters) });

test("curriculum workflow normalization preserves valid scope and deterministically replaces invalid scope", () => {
    const definitions = Object.freeze([
        curriculum("a",[unit("a-unit",["shared","a-two"])]),
        curriculum("b",[unit("b-unit",["shared","b-two"])])
    ]);
    const preserved = normalizeCurriculumSelection(definitions,{key:"b",unitId:"b-unit",lessonId:"b-two"});
    assert.deepEqual({key:preserved.key,unitId:preserved.unitId,lessonId:preserved.lessonId,changed:preserved.changed},{key:"b",unitId:"b-unit",lessonId:"b-two",changed:false});
    const fallback = normalizeCurriculumSelection([definitions[0]],{key:"b",unitId:"b-unit",lessonId:"shared"});
    assert.deepEqual({key:fallback.key,unitId:fallback.unitId,lessonId:fallback.lessonId,changed:fallback.changed},{key:"a",unitId:"a-unit",lessonId:"shared",changed:true});
    assert.equal(Object.isFrozen(fallback),true);
    assert.equal(definitions[1].units[0].lessons[0].id,"shared");
});

test("curriculum workflow normalization explicitly clears and restores complete scope", () => {
    const available = [curriculum("a",[unit("a-unit",["a-lesson"])])];
    const empty = normalizeCurriculumSelection([],{key:"old",unitId:"old-unit",lessonId:"old-lesson"});
    assert.deepEqual({key:empty.key,unitId:empty.unitId,lessonId:empty.lessonId,changed:empty.changed},{key:"",unitId:"",lessonId:"",changed:true});
    const restored = normalizeCurriculumSelection(available,empty);
    assert.deepEqual({key:restored.key,unitId:restored.unitId,lessonId:restored.lessonId,changed:restored.changed},{key:"a",unitId:"a-unit",lessonId:"a-lesson",changed:true});
});

test("template workflow normalization preserves valid intent and replaces stale overrides", () => {
    const available = [
        template("a",[parameter("direction","ascending")]),
        template("b",[parameter("octaves",2)])
    ];
    const preserved = normalizeTemplateSelection(available,{key:"a",overrides:{direction:"descending"}});
    assert.deepEqual({...preserved.overrides},{direction:"descending"});
    assert.equal(preserved.changed,false);
    const fallback = normalizeTemplateSelection([available[1]],{key:"a",overrides:{direction:"descending"}});
    assert.equal(fallback.key,"b");
    assert.deepEqual({...fallback.overrides},{octaves:2});
    assert.equal(fallback.changed,true);
    assert.equal(Object.isFrozen(fallback.overrides),true);
});
