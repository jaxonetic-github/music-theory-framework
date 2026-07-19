import test from "node:test";
import assert from "node:assert/strict";
import {
    CommandBus,
    EventBus,
    Kernel,
    KernelError,
    LifecycleState,
    ServiceContainer
} from "../src/core/index.js";

test("service container resolves values, factories, and circular dependencies", () => {
    const services = new ServiceContainer();
    services.register("value", 21);
    services.factory("answer", container => container.resolve("value") * 2);
    assert.equal(services.resolve("answer"), 42);
    assert.equal(services.resolve("answer"), 42);
    assert.equal(services.resolve("missing", { optional: true }), null);

    services.factory("a", container => container.resolve("b"));
    services.factory("b", container => container.resolve("a"));
    assert.throws(() => services.resolve("a"), /Circular service dependency: a -> b -> a/);
});

test("event bus honors priority, wildcard, and once subscriptions", async () => {
    const events = new EventBus();
    const calls = [];
    events.subscribe("note", event => calls.push(`normal:${event.payload}`));
    events.once("note", event => calls.push(`first:${event.payload}`), { priority: 10 });
    events.subscribe("*", event => calls.push(`all:${event.type}`));

    await events.publish("note", "C");
    await events.publish("note", "D");
    assert.deepEqual(calls, ["first:C", "normal:C", "all:note", "normal:D", "all:note"]);
});

test("command bus enforces one handler and executes commands", async () => {
    const commands = new CommandBus();
    commands.register("transpose", amount => amount + 12);
    assert.equal(await commands.execute("transpose", 3), 15);
    assert.throws(() => commands.register("transpose", () => 0), /already registered/);
    await assert.rejects(commands.execute("missing"), /No handler/);
});

test("kernel runs lifecycle hooks in safe order", async () => {
    const order = [];
    const kernel = new Kernel({ name: "test" });
    kernel.use({
        id: "first",
        configure(context) { context.services.register("answer", 42); order.push("configure:first"); },
        start() { order.push("start:first"); },
        stop() { order.push("stop:first"); },
        dispose() { order.push("dispose:first"); }
    });
    kernel.use({
        id: "second",
        configure() { order.push("configure:second"); },
        start() { order.push("start:second"); },
        stop() { order.push("stop:second"); },
        dispose() { order.push("dispose:second"); }
    });

    await kernel.start();
    assert.equal(kernel.state, LifecycleState.RUNNING);
    assert.equal(kernel.context.resolve("answer"), 42);
    await kernel.start();
    await kernel.stop();
    await kernel.dispose();
    assert.equal(kernel.state, LifecycleState.DISPOSED);
    assert.deepEqual(order, [
        "configure:first", "configure:second", "start:first", "start:second",
        "stop:second", "stop:first", "dispose:second", "dispose:first"
    ]);
});

test("kernel rolls back modules after a failed start", async () => {
    const order = [];
    const kernel = new Kernel();
    kernel.use({ id: "first", start() { order.push("start:first"); }, stop() { order.push("stop:first"); } });
    kernel.use({ id: "broken", start() { throw new Error("boom"); } });

    await assert.rejects(kernel.start(), error => error instanceof KernelError && error.cause.message === "boom");
    assert.equal(kernel.state, LifecycleState.FAILED);
    assert.deepEqual(order, ["start:first", "stop:first"]);
    await kernel.dispose();
});
