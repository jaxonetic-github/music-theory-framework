export class ExerciseSetWorkflowError extends Error { constructor(sectionId, itemId, cause) { super(`Exercise set workflow failed in section "${sectionId}", item "${itemId}": ${cause?.message ?? String(cause)}`, { cause }); this.name = "ExerciseSetWorkflowError"; this.sectionId = String(sectionId); this.itemId = String(itemId); Object.freeze(this); } }
export default ExerciseSetWorkflowError;
