import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
    Curriculum as CurriculumNamespace, CurriculumCatalog, CurriculumExpansionRequest, CurriculumModule,
    DifficultyLevel, ExerciseApplicationModule, ExerciseModule, ExerciseNotationModule,
    ExerciseSetModule, ExerciseTemplate, ExerciseTemplateCatalog, ExerciseTemplateParameter,
    Kernel, LayoutModule, NotationModule, RenderingModule, TheoryModule,
    builtInCurricula, builtInExerciseTemplates
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
    assert.throws(() => curricula.register("one", curriculumValue()), /not found/);
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
                templates: [{ templateId: "major-triad-arpeggios" }]
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
        assert.deepEqual(a.exerciseSetRequest.sections.map(value => value.id), ["scoped-lessons-unit-a-lesson-1"]);
        assert.deepEqual(b.exerciseSetRequest.sections.map(value => value.id), ["scoped-lessons-unit-b-lesson-1"]);
        assert.equal(a.exerciseSetRequest.items[0].metadata.unitId, "unit-a");
        assert.equal(b.exerciseSetRequest.items[0].metadata.unitId, "unit-b");
        assert.deepEqual({ ...a.metadata }, { curriculumId: "scoped-lessons", unitId: "unit-a", lessonId: "lesson-1", sectionCount: 1, itemCount: 1, deterministic: true });
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
