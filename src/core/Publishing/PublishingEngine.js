import { ValidationError } from "../Foundation/index.js";
import { PublicationPlanner } from "./PublicationPlanner.js";
import { PublishedDocument, PublishingRequest, PublishingResult } from "./values.js";
import { PublishingStrategyRegistry } from "./PublishingStrategyRegistry.js";
export class PublishingEngine{
    constructor({registry=new PublishingStrategyRegistry(),planner=new PublicationPlanner()}={}){this.registry=registry;this.planner=planner;Object.freeze(this);}
    plan(input){return this.planner.plan(PublishingRequest.from(input));}
    publish(input){const request=PublishingRequest.from(input),plan=this.planner.plan(request),strategy=this.registry.select(plan,{pluginId:request.pluginId,strategyId:request.strategyId});if(!strategy)throw new ValidationError(`No publishing strategy supports format "${request.format}".`);const document=strategy.publish(plan);if(!(document instanceof PublishedDocument)||document.plan!==plan||document.format!==request.format)throw new ValidationError(`Publishing strategy "${strategy.id}" returned an incompatible document.`);return new PublishingResult({request,plan,document,metadata:{strategy:{pluginId:String(strategy.pluginId),strategyId:String(strategy.id),format:strategy.format},sourceExerciseSetId:request.source.document.id,pageCount:plan.pageCount}});}
}
