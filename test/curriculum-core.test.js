import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
    Curriculum as CurriculumNamespace, CurriculumCatalog, CurriculumExpansionRequest, CurriculumModule,
    DifficultyLevel, ExerciseApplicationModule, ExerciseModule, ExerciseNotationModule,
    EXERCISE_SET_LIMITS, ExerciseSetModule, ExerciseTemplate, ExerciseTemplateCatalog, ExerciseTemplateParameter,
    Kernel, LayoutModule, NotationModule, RenderingModule, TheoryModule,
    boundedExerciseSetId, builtInCurricula, builtInExerciseTemplates
} from "../src/core/index.js";
const Curriculum = CurriculumNamespace.Curriculum;

const plugin = "test.curriculum";
const templateValue = (overrides = {}) => ({
    id: "custom-scale", name: "Custom scale", description: "A reusable scale.",
    family: "scale", objective: "Read exact spellings.", difficulty: "beginner",
    parameters: [
        { id: "root", contract: "root", required: true, defaultValue: "C" },
        { id: "pattern", contract: "choice", defaultValue: "major", validationSource: "theory.scaleCatalog" },
        { id: "direction", contract: "choice", defaultValue: "ascending", allowedValues: ["ascending", "descending"] }
    ],
    constraints: { pattern: "major" }, ...overrides
});
const curriculumValue = (overrides = {}) => ({
    id: "custom-course", title: "Custom course", description: "A small course.",
    objective: "Build fluency.", difficulty: "beginner", units: [{
        id: "unit", title: "Unit", objective: "Study scales.", lessons: [{
            id: "lesson", title: "Lesson", objective: "Read one scale.",
            templates: [{ templateId: "custom-scale", pluginId: plugin }]
        }]
    }], ...overrides
});
async function source() {
    const kernel = new Kernel().use(new TheoryModule()).use(new NotationModule());
    const layout = new LayoutModule();
    kernel.use(layout).use(new RenderingModule({ layoutEngine: layout.engine }))
        .use(new ExerciseModule()).use(new ExerciseNotationModule())
        .use(new ExerciseApplicationModule()).use(new ExerciseSetModule())
        .use(new CurriculumModule());
    await kernel.start();
    return kernel;
}

test("template values enforce immutable defaults, constraints, contracts, and difficulty order", () => {
    const input = templateValue(), before = structuredClone(input), value = new ExerciseTemplate(input);
    assert.deepEqual(input, before);
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.parameters), true);
    assert.equal(String(value.family), "scale");
    assert.ok(new DifficultyLevel("beginner").compare("advanced") < 0);
    assert.throws(() => new DifficultyLevel("expert"), /Unknown difficulty/);
    assert.throws(() => new ExerciseTemplateParameter({ id: "bad", contract: "mystery" }), /unsupported contract/);
    assert.throws(() => new ExerciseTemplate({ ...input, defaults: { unknown: 1 } }), /unknown parameter/);
});

test("curriculum values reject duplicate identities, dangling lesson prerequisites, cycles, and unsafe sizes", () => {
    const value = new Curriculum(curriculumValue());
    assert.equal(Object.isFrozen(value.units[0].lessons), true);
    assert.throws(() => new Curriculum(curriculumValue({ units: [
        curriculumValue().units[0], curriculumValue().units[0]
    ] })), /duplicate unit/i);
    assert.throws(() => new Curriculum(curriculumValue({ units: [{
        id: "unit", title: "Unit", objective: "X", lessons: [
            { id: "a", title: "A", objective: "A", prerequisites: ["b"], templates: [{ templateId: "custom-scale" }] },
            { id: "b", title: "B", objective: "B", prerequisites: ["a"], templates: [{ templateId: "custom-scale" }] }
        ]
    }] })), /cycle/i);
    assert.throws(() => new Curriculum(curriculumValue({ units: [] })), /non-empty/);
});

test("plugin catalogs enumerate deterministically and preserve isolation, replacement, removal, and snapshots", () => {
    const templates = new ExerciseTemplateCatalog(), a = new ExerciseTemplate(templateValue({ id: "z" })), b = new ExerciseTemplate(templateValue({ id: "a" }));
    templates.register("one", a); templates.register("one", b); templates.register("two", templateValue({ id: "a", name: "Other" }));
    assert.deepEqual(templates.values("one").map(value => value.id), ["a", "z"]);
    assert.notStrictEqual(templates.get("one", "a"), templates.get("two", "a"));
    assert.deepEqual(templates.entries().filter(entry => entry.value.id === "a").map(entry => entry.pluginId), ["one", "two"]);
    assert.strictEqual(templates.register("one", b), b);
    const replacement = new ExerciseTemplate(templateValue({ id: "a", name: "Replacement" }));
    templates.register("one", replacement, { replace: true });
    assert.strictEqual(templates.remove("one", "a"), replacement);
    templates.restore("one", replacement);
    assert.equal(Object.isFrozen(templates.snapshot("one").values), true);
    const stop = templates.subscribe(event => { if (event.id === "listener-failure") throw new Error("listener failed"); });
    assert.throws(() => templates.register("one", templateValue({ id: "listener-failure" })), /listener failed/);
    assert.equal(templates.get("one", "listener-failure"), null);
    stop();
    const curricula = new CurriculumCatalog(templates);
    assert.throws(() => curricula.register("one", curriculumValue()), /cannot resolve/);
});

test("built-in templates and curricula cover the milestone library and expand deterministically", async () => {
    assert.deepEqual(builtInExerciseTemplates.map(value => value.id), [
        "major-scales-canonical", "melodic-minor-scales", "scale-thirds",
        "major-triad-arpeggios", "minor-triad-arpeggios", "dominant-seventh-arpeggios",
        "diatonic-seventh-study", "chromatic-approach-targets", "enclosure-targets",
        "major-ii-v-i", "minor-ii-v-i", "twelve-bar-blues"
    ]);
    assert.deepEqual(builtInCurricula.map(value => value.id), ["beginner-fundamentals", "intermediate-harmony", "advanced-language"]);
    const kernel = await source();
    try {
        const engine = kernel.services.resolve("curriculum.engine");
        const first = engine.expandTemplate({ templateId: "major-scales-canonical" });
        const second = engine.expandTemplate({ templateId: "major-scales-canonical" });
        assert.deepEqual(first, second);
        assert.equal(first.exerciseSetRequest.items[0].application.exercise.allKeys, true);
        assert.equal(first.exerciseSetRequest.items[0].metadata.templateId, "major-scales-canonical");
        assert.throws(() => engine.expandTemplate({ templateId: "major-scales-canonical", overrides: { pattern: "minor" } }), /fixed/);
        assert.throws(() => engine.expandTemplate({ templateId: "melodic-minor-scales", overrides: { surprise: true } }), /unknown parameter/);
        const spelled = engine.expandTemplate({ templateId: "major-triad-arpeggios", overrides: { root: "B#" } });
        assert.equal(String(spelled.exerciseSetRequest.items[0].application.exercise.roots[0]), "B#");
        const approach = engine.expandTemplate({ templateId: "chromatic-approach-targets", overrides: { root: "Cb", target: "third" } });
        assert.equal(approach.parameters.root, "Cb");
        assert.equal(approach.parameters.target, "third");
        const progression = engine.expandTemplate({ templateId: "major-ii-v-i" });
        assert.equal(progression.parameters.progression, "ii-v-i-major");
        const course = engine.expandCurriculum(new CurriculumExpansionRequest({ curriculumId: "intermediate-harmony" }));
        assert.equal(course.exerciseSetRequest.sections.length, 2);
        assert.equal(course.exerciseSetRequest.items.length, 4);
        assert.equal(course.exerciseSetRequest.items.at(-1).metadata.progressionId, undefined);
        const worksheet = kernel.services.resolve("exercise.set.application").run(course.exerciseSetRequest);
        assert.equal(worksheet.document.items.length, 4);
        assert.equal(worksheet.document.items[0].metadata.curriculumId, "intermediate-harmony");
        assert.equal(worksheet.document.items[0].presentation.rows[0].mediaType, "image/svg+xml");
    } finally { await kernel.dispose(); }
});

test("lesson expansion requires unit scope and permits duplicate lesson IDs across units", async () => {
    const definition = {
        id: "scoped-lessons", title: "Scoped lessons", description: "Duplicate local identities.",
        objective: "Select one local lesson.", units: ["unit-a", "unit-b"].map((unitId, index) => ({
            id: unitId, title: `Unit ${index + 1}`, objective: `Objective ${index + 1}`, lessons: [{
                id: "lesson-1", title: `Lesson ${index + 1}`, objective: `Lesson objective ${index + 1}`,
                templates: [{ templateId: "major-triad-arpeggios", pluginId: "core.curriculum.builtins" }]
            }]
        }))
    };
    const sourceDefinition = structuredClone(definition), curriculum = new Curriculum(definition), kernel = await source();
    try {
        const engine = kernel.services.resolve("curriculum.engine");
        engine.curriculumCatalog.register(plugin, curriculum);
        assert.throws(() => new CurriculumExpansionRequest({ curriculumId: curriculum.id, pluginId: plugin, lessonId: "lesson-1" }), /requires its unitId/);
        assert.throws(() => engine.expandCurriculum({ curriculumId: curriculum.id, pluginId: plugin, unitId: "missing" }), /does not contain unit/);
        assert.throws(() => engine.expandCurriculum({ curriculumId: curriculum.id, pluginId: plugin, unitId: "unit-a", lessonId: "missing" }), /unit "unit-a".*lesson "missing"/);
        const a = engine.expandCurriculum({ curriculumId: curriculum.id, pluginId: plugin, unitId: "unit-a", lessonId: "lesson-1" });
        const b = engine.expandCurriculum({ curriculumId: curriculum.id, pluginId: plugin, unitId: "unit-b", lessonId: "lesson-1" });
        assert.match(a.exerciseSetRequest.sections[0].id, /^curriculum-section-unit-a-lesson-1-/);
        assert.match(b.exerciseSetRequest.sections[0].id, /^curriculum-section-unit-b-lesson-1-/);
        assert.equal(a.exerciseSetRequest.items[0].metadata.unitId, "unit-a");
        assert.equal(b.exerciseSetRequest.items[0].metadata.unitId, "unit-b");
        assert.equal(a.metadata.curriculumPluginId, plugin);
        assert.equal(a.metadata.curriculumId, "scoped-lessons");
        assert.equal(a.metadata.unitId, "unit-a");
        assert.equal(a.metadata.lessonId, "lesson-1");
        assert.equal(a.metadata.sectionCount, 1);
        assert.equal(a.metadata.itemCount, 1);
        assert.notEqual(a.exerciseSetRequest.id, b.exerciseSetRequest.id);
        assert.deepEqual(definition, sourceDefinition);
        assert.equal(Object.isFrozen(curriculum.units[0].lessons), true);
    } finally { await kernel.dispose(); }
});

test("CurriculumModule is reusable, resolves current active catalogs, and removes owned registrations", async () => {
    const kernel = new Kernel().use(new TheoryModule()).use(new ExerciseModule());
    await kernel.start();
    const module = new CurriculumModule();
    module.configure(kernel.context);
    const first = module.engine;
    assert.strictEqual(kernel.services.resolve("curriculum.engine"), first);
    module.dispose();
    assert.equal(kernel.services.resolve("curriculum.engine", { optional: true }), null);
    module.configure(kernel.context);
    assert.notStrictEqual(module.engine, first);
    module.dispose();
    await kernel.dispose();
});

test("Core Curriculum imports and expands without browser, font, audio, MIDI, or timer globals", () => {
    const script = `for(const name of ["window","document","ResizeObserver","AudioContext","navigator","MIDIInput","FontFace","setTimeout"])Object.defineProperty(globalThis,name,{configurable:true,get(){throw new Error("forbidden "+name)}});const C=await import("./src/core/index.js");const k=new C.Kernel().use(new C.TheoryModule()).use(new C.ExerciseModule()).use(new C.CurriculumModule());await k.start();const r=k.services.resolve("curriculum.engine").expandTemplate({templateId:"major-scales-canonical"});if(!r.exerciseSetRequest.items.length)throw new Error("missing");await k.dispose();`;
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr || child.stdout);
});

test("Curriculum capacity is derived from ExerciseSet limits and rejects incompatible aggregate structure", async () => {
    const lessonDefinition = index => ({id:`lesson-${index}`,title:`Lesson ${index}`,objective:"Capacity.",templates:[{templateId:"custom-scale"}]});
    const units = [
        {id:"unit-a",title:"A",objective:"A",lessons:Array.from({length:16},(_,index)=>lessonDefinition(index+1))},
        {id:"unit-b",title:"B",objective:"B",lessons:Array.from({length:16},(_,index)=>lessonDefinition(index+17))}
    ];
    const exact = new Curriculum({id:"exact-capacity",title:"Exact",description:"Exact.",objective:"Exact.",units});
    assert.equal(exact.units.flatMap(value=>value.lessons).length,EXERCISE_SET_LIMITS.sections);
    assert.throws(()=>new Curriculum({id:"over-capacity",title:"Over",description:"Over.",objective:"Over.",units:[...units,{id:"unit-c",title:"C",objective:"C",lessons:[lessonDefinition(33)]}]}),/33 lessons.*at most 32/);
    const oversizedItems=Array.from({length:EXERCISE_SET_LIMITS.itemsPerSection+1},()=>({templateId:"custom-scale"}));
    assert.throws(()=>new Curriculum({id:"section-over",title:"Over",description:"Over.",objective:"Over.",units:[{id:"unit",title:"Unit",objective:"Unit",lessons:[{id:"lesson",title:"Lesson",objective:"Lesson",templates:oversizedItems}]}]}),/1 through 64/);
    const fullLesson=(id,count=EXERCISE_SET_LIMITS.itemsPerSection)=>({id,title:id,objective:"Capacity.",templates:Array.from({length:count},()=>({templateId:"custom-scale"}))});
    const exactItems=new Curriculum({id:"exact-items",title:"Exact items",description:"Exact.",objective:"Exact.",units:[{id:"unit",title:"Unit",objective:"Unit.",lessons:Array.from({length:8},(_,index)=>fullLesson(`full-${index+1}`))}]});
    assert.throws(()=>new Curriculum({id:"over-items",title:"Over",description:"Over.",objective:"Over.",units:[{id:"unit",title:"Unit",objective:"Unit.",lessons:[...Array.from({length:8},(_,index)=>fullLesson(`full-${index+1}`)),fullLesson("one-more",1)]}]}),/513 template references.*at most 512/);
    const kernel=await source();try{const engine=kernel.services.resolve("curriculum.engine");engine.templateCatalog.register(plugin,templateValue());engine.curriculumCatalog.register(plugin,exact);engine.curriculumCatalog.register(plugin,exactItems);const result=engine.expandCurriculum({curriculumId:exact.id,pluginId:plugin}),items=engine.expandCurriculum({curriculumId:exactItems.id,pluginId:plugin});assert.equal(result.exerciseSetRequest.sections.length,EXERCISE_SET_LIMITS.sections);assert.equal(result.exerciseSetRequest.items.length,EXERCISE_SET_LIMITS.sections);assert.equal(items.exerciseSetRequest.items.length,EXERCISE_SET_LIMITS.totalItems);assert.equal(items.exerciseSetRequest.sections[0].items.length,EXERCISE_SET_LIMITS.itemsPerSection);}finally{await kernel.dispose();}
});

test("plugin-scoped template and curriculum identities preserve exact provenance", async () => {
    const kernel=await source();try{
        const engine=kernel.services.resolve("curriculum.engine"),template=new ExerciseTemplate(templateValue({id:"shared-template"})),definition={id:"shared-curriculum",title:"Shared",description:"Shared.",objective:"Shared.",version:"2.0.0",units:[{id:"unit",title:"Unit",objective:"Unit.",lessons:[{id:"lesson",title:"Lesson",objective:"Lesson.",templates:[{templateId:"shared-template"}]}]}]};
        engine.templateCatalog.register("plugin.a",template);engine.curriculumCatalog.register("plugin.a",definition);const before=engine.expandCurriculum({curriculumId:"shared-curriculum",pluginId:"plugin.a"});
        engine.templateCatalog.register("plugin.b",template);engine.curriculumCatalog.register("plugin.b",definition);
        const a=engine.expandCurriculum({curriculumId:"shared-curriculum",pluginId:"plugin.a"}),b=engine.expandCurriculum({curriculumId:"shared-curriculum",pluginId:"plugin.b"});
        assert.deepEqual(a,before);
        assert.notEqual(a.id,b.id);assert.notEqual(a.exerciseSetRequest.sections[0].id,b.exerciseSetRequest.sections[0].id);assert.notEqual(a.exerciseSetRequest.items[0].id,b.exerciseSetRequest.items[0].id);
        assert.equal(a.exerciseSetRequest.items[0].metadata.curriculumPluginId,"plugin.a");assert.equal(a.exerciseSetRequest.items[0].metadata.templatePluginId,"plugin.a");
        assert.equal(b.exerciseSetRequest.items[0].metadata.curriculumPluginId,"plugin.b");assert.equal(b.exerciseSetRequest.items[0].metadata.templatePluginId,"plugin.b");
        engine.curriculumCatalog.register("plugin.a",{id:"cross",title:"Cross",description:"Cross.",objective:"Cross.",units:[{id:"unit",title:"Unit",objective:"Unit.",lessons:[{id:"lesson",title:"Lesson",objective:"Lesson.",templates:[{templateId:"shared-template",pluginId:"plugin.b"}]}]}]});
        assert.equal(engine.expandCurriculum({curriculumId:"cross",pluginId:"plugin.a"}).exerciseSetRequest.items[0].metadata.templatePluginId,"plugin.b");
        engine.templateCatalog.remove("plugin.a","shared-template");
        assert.throws(()=>engine.expandCurriculum({curriculumId:"shared-curriculum",pluginId:"plugin.a"}),/plugin.a:shared-template/);
    }finally{await kernel.dispose();}
});

test("bounded generated IDs retain full long provenance and canonical deterministic inputs", async () => {
    const long=value=>`${value}-${"x".repeat(240)}`,templateId=long("template"),curriculumId=long("curriculum"),unitId=long("unit"),lessonId=long("lesson");
    const kernel=await source();try{
        const engine=kernel.services.resolve("curriculum.engine");
        engine.templateCatalog.register(plugin,templateValue({id:templateId,version:"9.1.0"}));
        engine.curriculumCatalog.register(plugin,{id:curriculumId,title:"Long",description:"Long IDs.",objective:"Long IDs.",units:[{id:unitId,title:"Unit",objective:"Unit.",lessons:[{id:lessonId,title:"Lesson",objective:"Lesson.",templates:[{templateId}]}]}]});
        const templateExpansion=engine.expandTemplate({templateId,pluginId:plugin}),first=engine.expandCurriculum({curriculumId,pluginId:plugin}),second=engine.expandCurriculum({curriculumId,pluginId:plugin});
        for(const id of [templateExpansion.id,templateExpansion.exerciseSetRequest.sections[0].id,templateExpansion.exerciseSetRequest.items[0].id,first.id,first.exerciseSetRequest.sections[0].id,first.exerciseSetRequest.items[0].id])assert.ok(id.length<=EXERCISE_SET_LIMITS.idLength,id);
        assert.deepEqual(first,second);assert.equal(first.exerciseSetRequest.items[0].metadata.curriculumId,curriculumId);assert.equal(first.exerciseSetRequest.items[0].metadata.unitId,unitId);assert.equal(first.exerciseSetRequest.items[0].metadata.lessonId,lessonId);assert.equal(first.exerciseSetRequest.items[0].metadata.templateId,templateId);
        engine.templateCatalog.register(plugin,templateValue({id:templateId,version:"9.2.0"}),{replace:true});
        assert.notEqual(templateExpansion.id,engine.expandTemplate({templateId,pluginId:plugin}).id);
        const left=boundedExerciseSetId({kind:"test",readable:"same",identity:{b:2,a:1}}),right=boundedExerciseSetId({kind:"test",readable:"same",identity:{a:1,b:2}});
        assert.equal(left,right);assert.notEqual(left,boundedExerciseSetId({kind:"test",readable:"same",identity:{a:1,b:3}}));
    }finally{await kernel.dispose();}
});
