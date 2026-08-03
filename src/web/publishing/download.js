import { HtmlPublishingStrategy } from "../../core/Publishing/index.js";

export function downloadPublishedAsset(asset,{document:documentValue=globalThis.document,URL:URLValue=globalThis.URL}={}){
    if(!asset||!documentValue?.createElement||!URLValue?.createObjectURL||!URLValue?.revokeObjectURL)throw new TypeError("Publishing download requires browser document and URL adapters.");
    const blob=new Blob([asset.content],{type:asset.mediaType}),url=URLValue.createObjectURL(blob);
    try{const anchor=documentValue.createElement("a");anchor.href=url;anchor.download=asset.filename;anchor.rel="noopener";anchor.click();}finally{URLValue.revokeObjectURL(url);}
}

export function authoritativePrintAsset(result){
    if(!result?.plan||!result?.document?.assets)throw new TypeError("Authoritative printing requires a completed PublishingResult.");
    const existing=result.document.assets.find(asset=>asset.format==="html"&&asset.mediaType==="text/html");
    if(existing)return existing;
    return new HtmlPublishingStrategy().publish(result.plan).assets[0];
}

function removeFrame(frame){
    if(typeof frame?.remove==="function")frame.remove();
    else frame?.parentNode?.removeChild?.(frame);
}

export class PublicationPrintController{
    #document;#job=null;#disposed=false;
    constructor({document:documentValue=globalThis.document}={}){
        if(!documentValue?.createElement||!documentValue?.body?.appendChild)throw new TypeError("Publication printing requires a browser document adapter.");
        this.#document=documentValue;
    }
    print(asset){
        if(this.#disposed)throw new TypeError("Publication print controller is disposed.");
        if(asset?.format!=="html"||asset?.mediaType!=="text/html"||typeof asset.content!=="string")throw new TypeError("Publication printing requires a completed print-ready HTML asset.");
        this.#cancel();
        return new Promise((resolve,reject)=>{
            const frame=this.#document.createElement("iframe"),job={frame,resolve,reject,settled:false};
            const settle=(error,value)=>{
                if(job.settled)return;
                job.settled=true;
                frame.onload=null;frame.onerror=null;removeFrame(frame);
                if(this.#job===job)this.#job=null;
                if(error)reject(error);else resolve(value);
            };
            job.settle=settle;this.#job=job;
            frame.hidden=true;frame.setAttribute?.("aria-hidden","true");frame.setAttribute?.("title",`Print ${asset.filename}`);
            frame.onload=()=>{
                if(this.#job!==job)return settle(null,false);
                try{
                    const target=frame.contentWindow;
                    if(typeof target?.print!=="function")throw new TypeError("Publication print frame does not expose print().");
                    target.focus?.();target.print();settle(null,true);
                }catch(error){settle(error);}
            };
            frame.onerror=()=>settle(new Error("The authoritative publication print frame failed to load."));
            frame.srcdoc=asset.content;
            this.#document.body.appendChild(frame);
        });
    }
    #cancel(){if(this.#job)this.#job.settle(null,false);}
    dispose(){if(this.#disposed)return;this.#disposed=true;this.#cancel();}
}
