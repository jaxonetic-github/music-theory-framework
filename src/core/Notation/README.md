# Notation Core and ScoreGraph

Milestone 5 translates immutable `GenerationResult` objects into validated score-domain graphs.

```js
import { Kernel, TheoryModule, NotationModule } from "../index.js";

const kernel = new Kernel().use(new TheoryModule()).use(new NotationModule());
await kernel.start();

const result = kernel.context.resolve("theory.scaleGenerator").generateResult("C", "major");
const score = kernel.context.resolve("notation.engine").notate(result);
console.log(score.nodesOfType("note").map(node => String(node.pitch)));
```

Strategies are isolated by plugin ID. Call `notate(result, { pluginId, strategyId })` to select a particular plugin strategy deterministically.
