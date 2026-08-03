import { validateTrustedSvgContent, xmlAttribute, xmlText } from "../../Rendering/index.js";
export const formatPublishingPoints = units => {
    if (!Number.isSafeInteger(units) || units < 0) throw new TypeError("Publishing dimensions must be non-negative safe integers in hundredths of a point.");
    const whole = Math.floor(units / 100), remainder = units % 100;
    return remainder === 0 ? `${whole}` : `${whole}.${String(remainder).padStart(2, "0").replace(/0+$/, "")}`;
};
export const points = formatPublishingPoints;
const IDREF_ATTRIBUTES=Object.freeze(["aria-labelledby","aria-describedby","aria-controls","aria-owns","aria-flowto","aria-activedescendant"]);
export function namespaceSvg(content,prefix,{x=0,y=0,width=null,height=null}={}){
    if(!validateTrustedSvgContent(content))throw new TypeError("Publishing accepts only trusted SVG.");
    const ids=new Map([...content.matchAll(/\bid\s*=\s*(["'])([^"']+)\1/gi)].map(match=>[match[2],`${prefix}-${match[2]}`]));
    let result=content.replace(/(\s)(id|href|xlink:href|aria-labelledby|aria-describedby|aria-controls|aria-owns|aria-flowto|aria-activedescendant)\s*=\s*(["'])(.*?)\3/gi,(match,space,name,quote,value)=>{
        const normalized=name.toLowerCase();
        if(normalized==="id")return `${space}${name}=${quote}${ids.get(value)??value}${quote}`;
        if(normalized==="href"||normalized==="xlink:href"){
            const next=value.startsWith("#")?ids.get(value.slice(1)):null;
            return `${space}${name}=${quote}${next?`#${next}`:value}${quote}`;
        }
        if(IDREF_ATTRIBUTES.includes(normalized))value=value.replace(/\S+/g,token=>ids.get(token)??token);
        return `${space}${name}=${quote}${value}${quote}`;
    });
    if(width!==null)result=result.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i,"$1");
    if(height!==null)result=result.replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i,"$1");
    result=result.replace(/^(\s*)<svg\b/i,`$1<svg x="${x}" y="${y}"${width===null?"":` width="${width}"`}${height===null?"":` height="${height}"`} preserveAspectRatio="xMinYMin meet"`);
    return result;
}
export function pageTitle(page,documentTitle){return `${documentTitle}, page ${page.number}`;}
export {xmlAttribute,xmlText};
