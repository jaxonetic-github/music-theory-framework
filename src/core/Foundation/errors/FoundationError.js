export class FoundationError extends Error {
  constructor(message, options = {}) {
    super(String(message), options);
    this.name = new.target.name;
    Object.defineProperty(this, "details", { value: Object.freeze({ ...(options.details ?? {}) }), enumerable: true });
  }
}
export default FoundationError;
