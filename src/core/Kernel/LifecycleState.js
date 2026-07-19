const values = ["created", "configuring", "configured", "starting", "running", "stopping", "stopped", "failed", "disposed"];

export const LifecycleState = Object.freeze(Object.fromEntries(values.map(value => [value.toUpperCase(), value])));

export function isLifecycleState(value) {
    return values.includes(value);
}

export default LifecycleState;
