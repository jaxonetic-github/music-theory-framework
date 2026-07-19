import { NotationEngine } from "./NotationEngine.js";
import { NotationStrategyRegistry } from "./NotationStrategyRegistry.js";
import { ChordNotationStrategy, ScaleNotationStrategy } from "./strategies/index.js";
import {
    defaultNotationPluginDescriptor, notationRendererDescriptors, notationServiceDescriptors
} from "./descriptors.js";
import { notationPackageDescriptor } from "./package.descriptor.js";

export class NotationModule {
    constructor(options = {}) {
        this.id = String(notationPackageDescriptor.id);
        this.descriptor = notationPackageDescriptor;
        this.strategyRegistry = options.strategyRegistry ?? new NotationStrategyRegistry();
        this.scaleStrategy = options.scaleStrategy ?? new ScaleNotationStrategy();
        this.chordStrategy = options.chordStrategy ?? new ChordNotationStrategy();
        this.strategyRegistry.register(this.scaleStrategy.pluginId, this.scaleStrategy);
        this.strategyRegistry.register(this.chordStrategy.pluginId, this.chordStrategy);
        this.engine = options.engine ?? new NotationEngine(this.strategyRegistry);
        Object.seal(this);
    }

    configure({ services, registries }) {
        services.register("notation.engine", this.engine);
        services.register("notation.strategyRegistry", this.strategyRegistry);
        registries.services.register(notationServiceDescriptors.engine, { value: this.engine });
        registries.services.register(notationServiceDescriptors.strategies, { value: this.strategyRegistry });
        registries.plugins.register(defaultNotationPluginDescriptor, { value: Object.freeze({
            id: String(defaultNotationPluginDescriptor.id),
            strategies: Object.freeze([this.scaleStrategy, this.chordStrategy])
        }) });
        registries.renderers.register(notationRendererDescriptors.scale, { value: this.scaleStrategy });
        registries.renderers.register(notationRendererDescriptors.chord, { value: this.chordStrategy });
    }

    dispose({ services, registries }) {
        services.unregister("notation.engine");
        services.unregister("notation.strategyRegistry");
        registries.services.unregister("notation.engine");
        registries.services.unregister("notation.strategy-registry");
        registries.plugins.unregister("core.notation.defaults");
        registries.renderers.unregister("notation.scale");
        registries.renderers.unregister("notation.chord");
        this.strategyRegistry.unregisterPlugin("core.notation.defaults");
    }
}

export default NotationModule;
