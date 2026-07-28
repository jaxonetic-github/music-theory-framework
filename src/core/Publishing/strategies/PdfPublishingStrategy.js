import { boundedExerciseSetId } from "../../ExerciseSet/index.js";
import { PublishedAsset, PublishedDocument } from "../values.js";
import { PublishingStrategy } from "../PublishingStrategy.js";

const enc = new TextEncoder();
const pdfText = value => String(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[^\x20-\x7E]/g,"?");
const attr = (tag,name,fallback=0) => Number(tag.match(new RegExp(`\\b${name}="([^"]+)"`,"i"))?.[1] ?? fallback);
const number = value => Number(value).toFixed(3).replace(/\.?0+$/,"");
function pathOperators(tag,mapX,mapY,scale){
    const data=tag.match(/\bd="([^"]+)"/i)?.[1];if(!data)return"";
    const tokens=data.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)??[];let index=0,command="",cx=0,cy=0,sx=0,sy=0;const out=[];
    const numeric=()=>Number(tokens[index++]),point=(px,py)=>`${number(mapX(px))} ${number(mapY(py))}`;
    while(index<tokens.length){if(/[a-zA-Z]/.test(tokens[index]))command=tokens[index++];if(!command)break;const relative=command===command.toLowerCase(),upper=command.toUpperCase();
        if(upper==="M"||upper==="L"){const px=numeric(),py=numeric();cx=relative?cx+px:px;cy=relative?cy+py:py;if(upper==="M"){sx=cx;sy=cy;}out.push(`${point(cx,cy)} ${upper==="M"?"m":"l"}`);if(upper==="M")command=relative?"l":"L";}
        else if(upper==="H"){const value=numeric();cx=relative?cx+value:value;out.push(`${point(cx,cy)} l`);}
        else if(upper==="V"){const value=numeric();cy=relative?cy+value:value;out.push(`${point(cx,cy)} l`);}
        else if(upper==="C"){const values=Array.from({length:6},numeric),x1=relative?cx+values[0]:values[0],y1=relative?cy+values[1]:values[1],x2=relative?cx+values[2]:values[2],y2=relative?cy+values[3]:values[3],x3=relative?cx+values[4]:values[4],y3=relative?cy+values[5]:values[5];out.push(`${point(x1,y1)} ${point(x2,y2)} ${point(x3,y3)} c`);cx=x3;cy=y3;}
        else if(upper==="Z"){out.push("h");cx=sx;cy=sy;command="";}
        else break;
    }
    const fill=/\bfill="(?:currentColor|black)"/i.test(tag),none=/\bfill="none"/i.test(tag),stroke=/\bstroke="(?:currentColor|black)"/i.test(tag)||none,width=Math.max(.35,attr(tag,"stroke-width",1)*scale);
    return `${number(width)} w ${out.join(" ")} ${fill&&stroke?"B":fill?"f":"S"}`;
}
function transformedPaths(svg,mapX,mapY,scale){
    const stack=[[0,0]],result=[];for(const match of svg.matchAll(/<\/?g\b[^>]*>|<path\b[^>]*>/gi)){const tag=match[0];if(/^<\/g/i.test(tag)){if(stack.length>1)stack.pop();continue;}const translation=tag.match(/\btransform="translate\(\s*([-+.\d]+)(?:[\s,]+([-+.\d]+))?\s*\)"/i),parent=stack.at(-1),offset=[parent[0]+Number(translation?.[1]??0),parent[1]+Number(translation?.[2]??0)];if(/^<g/i.test(tag)){stack.push(offset);continue;}result.push(pathOperators(tag,value=>mapX(value+offset[0]),value=>mapY(value+offset[1]),scale));}return result;
}

function notationOperators(block,pageHeight){
    const scale=block.metadata.scale/100,offsetX=block.x/100,top=block.y/100;
    const y=value=>pageHeight-(top+value*scale),x=value=>offsetX+value*scale;
    const output=["0 0 0 RG","0 0 0 rg"];
    for(const match of block.svg.matchAll(/<line\b[^>]*>/gi)){const tag=match[0],x1=x(attr(tag,"x1")),x2=x(attr(tag,"x2")),y1=y(attr(tag,"y1")),y2=y(attr(tag,"y2")),stroke=Math.max(.35,attr(tag,"stroke-width",1)*scale);output.push(`${number(stroke)} w ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S`);}
    for(const match of block.svg.matchAll(/<(circle|ellipse)\b[^>]*>/gi)){const tag=match[0],cx=x(attr(tag,"cx")),cy=y(attr(tag,"cy")),rx=(match[1].toLowerCase()==="circle"?attr(tag,"r"):attr(tag,"rx"))*scale,ry=(match[1].toLowerCase()==="circle"?attr(tag,"r"):attr(tag,"ry"))*scale,k=.5522847498;const fill=/\bfill="(?:currentColor|black)"/i.test(tag),stroke=/\bstroke="(?:currentColor|black)"/i.test(tag);output.push(`${number(cx+rx)} ${number(cy)} m ${number(cx+rx)} ${number(cy+k*ry)} ${number(cx+k*rx)} ${number(cy+ry)} ${number(cx)} ${number(cy+ry)} c ${number(cx-k*rx)} ${number(cy+ry)} ${number(cx-rx)} ${number(cy+k*ry)} ${number(cx-rx)} ${number(cy)} c ${number(cx-rx)} ${number(cy-k*ry)} ${number(cx-k*rx)} ${number(cy-ry)} ${number(cx)} ${number(cy-ry)} c ${number(cx+k*rx)} ${number(cy-ry)} ${number(cx+rx)} ${number(cy-k*ry)} ${number(cx+rx)} ${number(cy)} c ${fill&&stroke?"B":fill?"f":"S"}`);}
    output.push(...transformedPaths(block.svg,x,y,scale));
    return output.join("\n");
}
function pageStream(page){
    const height=page.profile.height/100,ops=["0 0 0 rg"];
    for(const block of page.blocks){if(block.type==="notation"){ops.push(notationOperators(block,height));continue;}const size=block.type==="title"?22:block.type==="section-heading"?16:block.type==="item-heading"?13:10;ops.push(`BT /F1 ${size} Tf ${number(block.x/100)} ${number(height-(block.y/100)-size)} Td (${pdfText(block.text)}) Tj ET`);}
    return ops.join("\n");
}
function pdf(plan){
    const objects=[null],reserve=()=>{objects.push("");return objects.length-1;},catalog=reserve(),pagesRoot=reserve(),font=reserve(),pageIds=[];
    objects[font]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    for(const page of plan.pages){const pageId=reserve(),contentId=reserve(),stream=pageStream(page),w=number(page.profile.width/100),h=number(page.profile.height/100);objects[contentId]=`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`;objects[pageId]=`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`;pageIds.push(pageId);}
    const info=reserve();objects[pagesRoot]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;objects[catalog]=`<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;objects[info]=`<< /Title (${pdfText(plan.request.title)}) /Author (${pdfText(plan.request.author||plan.request.organization)}) /Subject (${pdfText(plan.request.subtitle)}) /Creator (Music Theory Framework Publishing Core) >>`;
    let body="%PDF-1.7\n%\xE2\xE3\xCF\xD3\n",offsets=[0];for(let index=1;index<objects.length;index+=1){offsets[index]=enc.encode(body).length;body+=`${index} 0 obj\n${objects[index]}\nendobj\n`;}const xref=enc.encode(body).length;body+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value=>`${String(value).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return enc.encode(body);}
export class PdfPublishingStrategy extends PublishingStrategy{
    constructor({pluginId="core.publishing.builtins"}={}){super({id:"pdf-vector",pluginId,format:"pdf",mediaType:"application/pdf"});}
    publish(plan){const content=pdf(plan),asset=new PublishedAsset({id:boundedExerciseSetId({kind:"published-asset",readable:plan.request.filenameBase,identity:{plan:plan.id,format:"pdf"}}),filename:`${plan.request.filenameBase}.pdf`,format:"pdf",mediaType:"application/pdf",content,metadata:{pageCount:plan.pageCount,deterministicBytes:true,vectorNotation:"SVG line and notehead primitives"}});return new PublishedDocument({id:boundedExerciseSetId({kind:"published-document",readable:plan.request.filenameBase,identity:{plan:plan.id,format:"pdf"}}),plan,assets:[asset],format:"pdf",mediaType:"application/pdf",filename:asset.filename,metadata:{adapter:"repository-owned-pdf-1.7",timestamps:false,randomIds:false,taggedPdf:false}});}
}
