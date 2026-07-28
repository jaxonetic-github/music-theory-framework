import { boundedExerciseSetId } from "../../ExerciseSet/index.js";
import { PublishedAsset, PublishedDocument } from "../values.js";
import { PublishingStrategy } from "../PublishingStrategy.js";
import { namespaceSvg, pageTitle, xmlAttribute, xmlText } from "./shared.js";
function textBlock(block){
    const layout=block.metadata.textLayout;
    if(!layout)throw new TypeError(`Publication text block "${block.id}" is missing its authoritative text layout.`);
    const lines=layout.lines.map(line=>`<tspan x="${block.x}" y="${block.y+layout.fontSize+line.yOffset}" data-line-index="${line.index}" data-line-width="${line.width}">${xmlText(line.text || " ")}</tspan>`).join("");
    return `<text font-family="sans-serif" font-size="${layout.fontSize}" font-weight="${layout.weight}" fill="currentColor" role="text" aria-label="${xmlAttribute(layout.sourceText)}" data-source-text-id="${xmlAttribute(layout.sourceTextIdentity)}">${lines}</text>`;
}
export class SvgPublishingStrategy extends PublishingStrategy{
    constructor({pluginId="core.publishing.builtins"}={}){super({id:"svg-pages",pluginId,format:"svg",mediaType:"image/svg+xml"});}
    publish(plan){const assets=plan.pages.map(page=>{const titleId=`${page.id}-title`,descId=`${page.id}-description`;const body=page.blocks.map(block=>block.type==="notation"?namespaceSvg(block.svg,block.id,{x:block.x,y:block.y,width:block.width,height:block.height}):textBlock(block)).join("");const content=`<svg xmlns="http://www.w3.org/2000/svg" width="${page.profile.width}" height="${page.profile.height}" viewBox="0 0 ${page.profile.width} ${page.profile.height}" role="img" aria-labelledby="${xmlAttribute(titleId)} ${xmlAttribute(descId)}"><title id="${xmlAttribute(titleId)}">${xmlText(pageTitle(page,plan.request.title))}</title><desc id="${xmlAttribute(descId)}">Print-ready worksheet page ${page.number} of ${plan.pageCount}, preserving conventional vector notation and source traceability.</desc><rect width="100%" height="100%" fill="white"/>${body}</svg>`;return new PublishedAsset({id:boundedExerciseSetId({kind:"published-page-asset",readable:`${plan.request.filenameBase}-${page.number}`,identity:{plan:plan.id,page:page.number,format:"svg"}}),filename:`${plan.request.filenameBase}-page-${page.number}.svg`,format:"svg",mediaType:"image/svg+xml",content,pageNumber:page.number,metadata:{pageId:page.id,width:page.profile.width,height:page.profile.height}});});return new PublishedDocument({id:boundedExerciseSetId({kind:"published-document",readable:plan.request.filenameBase,identity:{plan:plan.id,format:"svg"}}),plan,assets,format:"svg",mediaType:"image/svg+xml",filename:`${plan.request.filenameBase}-svg-pages`,metadata:{representation:"one-svg-asset-per-page"}});}
}
