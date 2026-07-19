export class ApplicationWorkflowError extends Error {
    constructor(stage, cause) {
        super(`Application workflow failed during ${stage}: ${cause?.message ?? String(cause)}`, { cause });
        this.name = "ApplicationWorkflowError";
        this.stage = String(stage);
        Object.freeze(this);
    }
}

export default ApplicationWorkflowError;
