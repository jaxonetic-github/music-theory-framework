import { ChordCatalog, ScaleCatalog } from "./catalogs/index.js";
import { ChordGenerator, ScaleGenerator } from "./generation/index.js";
import { theoryGeneratorDescriptors, theoryServiceDescriptors } from "./descriptors.js";
import { theoryPackageDescriptor } from "./package.descriptor.js";

export class TheoryModule {
    constructor(options = {}) {
        this.id = String(theoryPackageDescriptor.id);
        this.descriptor = theoryPackageDescriptor;
        this.scaleCatalog = options.scaleCatalog ?? new ScaleCatalog();
        this.chordCatalog = options.chordCatalog ?? new ChordCatalog();
        this.scaleGenerator = options.scaleGenerator ?? new ScaleGenerator(this.scaleCatalog);
        this.chordGenerator = options.chordGenerator ?? new ChordGenerator(this.chordCatalog);
        Object.seal(this);
    }

    configure({ services, registries }) {
        services.register("theory.scaleCatalog", this.scaleCatalog);
        services.register("theory.chordCatalog", this.chordCatalog);
        services.register("theory.scaleGenerator", this.scaleGenerator);
        services.register("theory.chordGenerator", this.chordGenerator);
        registries.services.register(theoryServiceDescriptors.scaleCatalog, { value: this.scaleCatalog });
        registries.services.register(theoryServiceDescriptors.chordCatalog, { value: this.chordCatalog });
        registries.generators.register(theoryGeneratorDescriptors.scale, { value: this.scaleGenerator });
        registries.generators.register(theoryGeneratorDescriptors.chord, { value: this.chordGenerator });
    }

    dispose({ services, registries }) {
        services.unregister("theory.scaleCatalog");
        services.unregister("theory.chordCatalog");
        services.unregister("theory.scaleGenerator");
        services.unregister("theory.chordGenerator");
        registries.services.unregister("theory.scale-catalog");
        registries.services.unregister("theory.chord-catalog");
        registries.generators.unregister("theory.scale-generator");
        registries.generators.unregister("theory.chord-generator");
    }
}

export default TheoryModule;
