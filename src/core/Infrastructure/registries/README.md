# Infrastructure Registries

Typed runtime registries built on the Foundation milestone.

## Core behavior

- Descriptor-type constraints
- Canonical identifier and alias lookup
- Duplicate and alias-collision detection
- Optional dependency validation
- Runtime value registration separate from descriptors
- Immutable registration records and snapshots
- Subscribe/unsubscribe hooks for later EventBus integration
- Deterministic insertion ordering

## Example

```js
const registry = new ServiceRegistry();
registry.register(serviceDescriptor, {
    value: serviceInstance,
    aliases: ["theory-generator"]
});

const service = registry.resolve("theory-generator", { required: true });
```
