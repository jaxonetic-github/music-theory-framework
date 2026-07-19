# Infrastructure Registries

Typed runtime registries built on the Foundation milestone.

Specialized registries include first-class generator, renderer, exporter, and playback-planner discovery. `PlaybackRegistry` accepts only `PlaybackDescriptor` values and is exposed as `kernel.registries.playbacks`; it is not renderer discovery and does not perform strategy selection or audio output.

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
