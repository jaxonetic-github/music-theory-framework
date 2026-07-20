# Infrastructure Registries

Typed runtime registries built on the Foundation milestone.

Specialized registries include first-class generator, renderer, exporter, playback-planner, and exercise discovery. `PlaybackRegistry` accepts only `PlaybackDescriptor` values. `ExerciseRegistry` accepts only `ExerciseDescriptor` values and is exposed as `kernel.registries.exercises`; it remains distinct from plugin-scoped exercise strategy selection.

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
