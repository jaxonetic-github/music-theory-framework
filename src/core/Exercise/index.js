export { ExerciseType, EXERCISE_TYPES } from "./ExerciseType.js";
export { ExerciseDirection, EXERCISE_DIRECTIONS } from "./ExerciseDirection.js";
export { ExerciseRequest, CANONICAL_EXERCISE_ROOTS } from "./ExerciseRequest.js";
export { ExerciseStep } from "./ExerciseStep.js";
export { ExerciseRow } from "./ExerciseRow.js";
export { ExerciseSection } from "./ExerciseSection.js";
export { ExerciseModel } from "./ExerciseModel.js";
export { ExerciseEngine } from "./ExerciseEngine.js";
export { ExerciseStrategyRegistry } from "./ExerciseStrategyRegistry.js";
export * from "./strategies/index.js";
export * from "./advanced/index.js";
export { ExerciseModule } from "./ExerciseModule.js";
export { exerciseServiceDescriptors, defaultExercisePluginDescriptor, advancedExercisePluginDescriptor, exerciseStrategyDescriptors } from "./descriptors.js";
export { exercisePackageDescriptor } from "./package.descriptor.js";

import { ExerciseType, EXERCISE_TYPES } from "./ExerciseType.js";
import { ExerciseDirection, EXERCISE_DIRECTIONS } from "./ExerciseDirection.js";
import { ExerciseRequest, CANONICAL_EXERCISE_ROOTS } from "./ExerciseRequest.js";
import { ExerciseStep } from "./ExerciseStep.js";
import { ExerciseRow } from "./ExerciseRow.js";
import { ExerciseSection } from "./ExerciseSection.js";
import { ExerciseModel } from "./ExerciseModel.js";
import { ExerciseEngine } from "./ExerciseEngine.js";
import { ExerciseStrategyRegistry } from "./ExerciseStrategyRegistry.js";
import { ExerciseStrategy, FoundationalExerciseStrategy, AdvancedExerciseStrategy } from "./strategies/index.js";
import { ApproachPattern, APPROACH_PATTERNS, EnclosurePattern, ENCLOSURE_PATTERNS, ChordTarget, CHORD_TARGETS, chordMemberRoles, ProgressionDefinition, ProgressionCatalog, defaultProgressions } from "./advanced/index.js";
import { ExerciseModule } from "./ExerciseModule.js";
import { exerciseServiceDescriptors, defaultExercisePluginDescriptor, advancedExercisePluginDescriptor, exerciseStrategyDescriptors } from "./descriptors.js";
import { exercisePackageDescriptor } from "./package.descriptor.js";

export const Exercise = Object.freeze({
    ExerciseType, EXERCISE_TYPES, ExerciseDirection, EXERCISE_DIRECTIONS, ExerciseRequest, CANONICAL_EXERCISE_ROOTS,
    ExerciseStep, ExerciseRow, ExerciseSection, ExerciseModel, ExerciseEngine, ExerciseStrategyRegistry,
    ExerciseStrategy, FoundationalExerciseStrategy, AdvancedExerciseStrategy, ApproachPattern, APPROACH_PATTERNS,
    EnclosurePattern, ENCLOSURE_PATTERNS, ChordTarget, CHORD_TARGETS, chordMemberRoles, ProgressionDefinition, ProgressionCatalog, defaultProgressions,
    ExerciseModule, serviceDescriptors: exerciseServiceDescriptors, pluginDescriptor: defaultExercisePluginDescriptor,
    advancedPluginDescriptor: advancedExercisePluginDescriptor, strategyDescriptors: exerciseStrategyDescriptors, descriptor: exercisePackageDescriptor
});

export default Exercise;
