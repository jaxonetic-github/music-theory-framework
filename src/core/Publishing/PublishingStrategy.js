import { Identifier, StrategyContract, ValidationError } from "../Foundation/index.js";
import { PublicationPlan } from "./values.js";
export class PublishingStrategy extends StrategyContract {
    constructor({ id, pluginId, format, mediaType } = {}) { super(); this.id=Identifier.from(id);this.pluginId=Identifier.from(pluginId);this.format=String(format??"").toLowerCase();this.mediaType=String(mediaType??"").toLowerCase();if(!this.format||!this.mediaType.includes("/"))throw new ValidationError("Publishing strategy requires format and media type.");Object.freeze(this); }
    supports(plan){return plan instanceof PublicationPlan;}
    publish(){throw new Error("PublishingStrategy.publish() must be implemented.");}
}
