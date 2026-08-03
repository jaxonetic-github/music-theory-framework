import { validateTrustedSvgContent, xmlAttribute, xmlText } from "../../Rendering/index.js";
export const formatPublishingPoints = units => {
    if (!Number.isSafeInteger(units) || units < 0) throw new TypeError("Publishing dimensions must be non-negative safe integers in hundredths of a point.");
    const whole = Math.floor(units / 100), remainder = units % 100;
    return remainder === 0 ? `${whole}` : `${whole}.${String(remainder).padStart(2, "0").replace(/0+$/, "")}`;
};
export const points = formatPublishingPoints;
const IDREF_ATTRIBUTES=Object.freeze(["aria-labelledby","aria-describedby","aria-controls","aria-owns","aria-flowto","aria-activedescendant"]);
const ROOT_GEOMETRY_ATTRIBUTES=Object.freeze(["x","y","width","height","preserveAspectRatio"]);
function replaceRootGeometry(content,{x,y,width,height}){
    let quote=null,end=-1;
    const start=content.search(/<svg\b/i);
    if(start<0)throw new TypeError("Publishing SVG must contain a root svg element.");
    for(let index=start+4;index<content.length;index+=1){const character=content[index];if(quote){if(character===quote)quote=null;}else if(character==='"'||character==="'")quote=character;else if(character===">"){end=index;break;}}
    if(end<0)throw new TypeError("Publishing SVG root element is unterminated.");
    let opening=content.slice(start,end+1);
    const replacements={x:String(x),y:String(y),preserveAspectRatio:"xMinYMin meet",...(width===null?{}:{width:String(width)}),...(height===null?{}:{height:String(height)})};
    for(const name of ROOT_GEOMETRY_ATTRIBUTES){
        if(!(name in replacements))continue;
        opening=opening.replace(new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`,"gi"),"");
    }
    const attributes=Object.entries(replacements).map(([name,value])=>` ${name}="${xmlAttribute(value)}"`).join("");
    opening=opening.replace(/<svg\b/i,`<svg${attributes}`);
    return content.slice(0,start)+opening+content.slice(end+1);
}
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
    return replaceRootGeometry(result,{x,y,width,height});
}
export function pageTitle(page,documentTitle){return `${documentTitle}, page ${page.number}`;}
export {xmlAttribute,xmlText};
