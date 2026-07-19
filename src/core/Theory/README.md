# Theory Domain and Generation Core

Milestone 4 adds immutable pitch, interval, note, scale, and chord models; validated default pattern catalogs; and scale and chord generators.

```js
import { Kernel, TheoryModule } from "../index.js";

const kernel = new Kernel().use(new TheoryModule());
await kernel.start();

const scales = kernel.context.resolve("theory.scaleGenerator");
const cMajor = scales.generate("C", "major");
console.log(cMajor.pitchClasses.map(String));

const result = scales.generateResult("C", "major");
console.log(result.graph.traverse("output:scale").map(String));
```

The `TheoryModule` publishes catalog services through the service registry and generation services through both the service container and generator registry. Existing `generate()` methods return domain models directly; `generateResult()` returns the same model together with its immutable, deterministically ordered `TheoryGraph`.
