# Kernel Runtime

The Kernel Runtime composes the framework registries and owns application lifecycle.

```js
import { Kernel } from "./index.js";

const kernel = new Kernel();
kernel.use({
    id: "example",
    configure({ services }) { services.register("answer", 42); },
    start(context) { console.log(context.resolve("answer")); }
});

await kernel.start();
await kernel.stop();
await kernel.dispose();
```

Modules configure and start in installation order. They stop and dispose in reverse order. A failed start rolls back every module that already started.
