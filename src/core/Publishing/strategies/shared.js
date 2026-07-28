import { validateTrustedSvgContent, xmlAttribute, xmlText } from "../../Rendering/index.js";
export const points = units => `${(units/100).toFixed(2).replace(/\.?0+$/,"")}`;
export function namespaceSvg(content,prefix,{x=0,y=0,width=null,height=null}={}){
    if(!validateTrustedSvgContent(content))throw new TypeError("Publishing accepts only trusted SVG.");
    const ids=[...content.matchAll(/\bid=(["'])([^"']+)\1/g)].map(match=>match[2]);
    let result=content;
    for(const original of ids){const next=`${prefix}-${original}`;result=result.replaceAll(`id="${original}"`,`id="${next}"`).replaceAll(`id='${original}'`,`id='${next}'`).replaceAll(`#${original}`,`#${next}`);result=result.replace(new RegExp(`(aria-(?:labelledby|describedby)=["'][^"']*)\\b${original}\\b`,"g"),`$1${next}`);}
    if(width!==null)result=result.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i,"$1");
    if(height!==null)result=result.replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i,"$1");
    result=result.replace(/^(\s*)<svg\b/i,`$1<svg x="${x}" y="${y}"${width===null?"":` width="${width}"`}${height===null?"":` height="${height}"`} preserveAspectRatio="xMinYMin meet"`);
    return result;
}
export function pageTitle(page,documentTitle){return `${documentTitle}, page ${page.number}`;}
export {xmlAttribute,xmlText};
