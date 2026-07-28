const configurable = template => template?.parameters?.filter(parameter => !parameter.fixed) ?? [];
const defaults = template => Object.fromEntries(configurable(template).filter(parameter => parameter.defaultValue !== null).map(parameter => [parameter.id, parameter.defaultValue]));
const equivalent = (left,right) => JSON.stringify(left) === JSON.stringify(right);

export function filterTemplates(templates, { family="all", difficulty="all", tag="all" }={}) {
    return templates.filter(value => (family === "all" || value.family === family) && (difficulty === "all" || value.difficulty === difficulty) && (tag === "all" || value.tags.includes(tag)));
}

export function filterCurricula(curricula, { difficulty="all", tag="all" }={}) {
    return curricula.filter(value => (difficulty === "all" || value.difficulty === difficulty) && (tag === "all" || value.tags.includes(tag)));
}

export function normalizeTemplateSelection(available, current={ key:"", overrides:{} }) {
    const template = available.find(value => value.key === current.key) ?? available[0] ?? null;
    if (!template) return Object.freeze({ template:null, key:"", overrides:Object.freeze({}), changed:current.key !== "" || Object.keys(current.overrides).length > 0 });
    if (template.key !== current.key) return Object.freeze({ template, key:template.key, overrides:Object.freeze(defaults(template)), changed:true });
    const allowed = new Map(configurable(template).map(parameter => [parameter.id, parameter]));
    const overrides = defaults(template);
    for (const [key,value] of Object.entries(current.overrides)) if (allowed.has(key)) overrides[key] = value;
    const changed = !equivalent(current.overrides,overrides);
    return Object.freeze({ template, key:template.key, overrides:Object.freeze(overrides), changed });
}

export function normalizeCurriculumSelection(available, current={ key:"", unitId:"", lessonId:"" }) {
    const curriculum = available.find(value => value.key === current.key) ?? available[0] ?? null;
    if (!curriculum) return Object.freeze({ curriculum:null, key:"", unitId:"", lessonId:"", changed:current.key !== "" || current.unitId !== "" || current.lessonId !== "" });
    const sameCurriculum = curriculum.key === current.key;
    const unit = sameCurriculum ? curriculum.units.find(value => value.id === current.unitId) : null;
    const normalizedUnit = unit ?? curriculum.units[0] ?? null;
    const lesson = sameCurriculum && unit ? unit.lessons.find(value => value.id === current.lessonId) : null;
    const normalizedLesson = lesson ?? normalizedUnit?.lessons[0] ?? null;
    const unitId = normalizedUnit?.id ?? "", lessonId = normalizedLesson?.id ?? "";
    return Object.freeze({ curriculum, key:curriculum.key, unitId, lessonId, changed:curriculum.key !== current.key || unitId !== current.unitId || lessonId !== current.lessonId });
}
