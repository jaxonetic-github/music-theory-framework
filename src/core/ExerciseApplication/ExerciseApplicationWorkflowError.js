export class ExerciseApplicationWorkflowError extends Error {
    constructor(stage, cause, rowId = null) {
        super(`Exercise application workflow failed during ${stage}${rowId ? ` for row "${rowId}"` : ""}: ${cause?.message ?? String(cause)}`, { cause });
        this.name = "ExerciseApplicationWorkflowError"; this.stage = String(stage); this.rowId = rowId === null ? null : String(rowId); Object.freeze(this);
    }
}
export default ExerciseApplicationWorkflowError;
