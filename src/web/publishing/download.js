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
    #document;#ownerWindow;#setTimeout;#clearTimeout;#fallbackDelay;#jobs=new Set();#disposed=false;
    constructor({document:documentValue=globalThis.document,ownerWindow=documentValue?.defaultView??globalThis.window,setTimeout:setTimeoutValue=globalThis.setTimeout,clearTimeout:clearTimeoutValue=globalThis.clearTimeout,fallbackDelay=120000}={}){
        if(!documentValue?.createElement||!documentValue?.body?.appendChild)throw new TypeError("Publication printing requires a browser document adapter.");
        if(typeof setTimeoutValue!=="function"||typeof clearTimeoutValue!=="function"||!Number.isSafeInteger(fallbackDelay)||fallbackDelay<1000)throw new TypeError("Publication printing requires timer adapters and a fallback delay of at least 1000 milliseconds.");
        this.#document=documentValue;this.#ownerWindow=ownerWindow;this.#setTimeout=setTimeoutValue;this.#clearTimeout=clearTimeoutValue;this.#fallbackDelay=fallbackDelay;
    }
    print(asset){
        if(this.#disposed)throw new TypeError("Publication print controller is disposed.");
        if(asset?.format!=="html"||asset?.mediaType!=="text/html"||typeof asset.content!=="string")throw new TypeError("Publication printing requires a completed print-ready HTML asset.");
        return new Promise((resolve,reject)=>{
            const frame=this.#document.createElement("iframe"),job={frame,resolve,reject,settled:false,invoked:false,timer:null,listeners:[],media:null,sawPrintMedia:false};
            const listen=(target,type,handler)=>{if(typeof target?.addEventListener!=="function")return;target.addEventListener(type,handler);job.listeners.push(()=>target.removeEventListener?.(type,handler));};
            const cleanup=()=>{if(job.timer!==null)this.#clearTimeout(job.timer);job.timer=null;for(const remove of job.listeners.splice(0))remove();job.media=null;frame.onload=null;frame.onerror=null;removeFrame(frame);this.#jobs.delete(job);};
            const settle=(error,value)=>{
                if(job.settled)return;
                job.settled=true;cleanup();
                if(error)reject(error);else resolve(value);
            };
            job.settle=settle;this.#jobs.add(job);
            frame.hidden=true;frame.setAttribute?.("aria-hidden","true");frame.setAttribute?.("title",`Print ${asset.filename}`);
            frame.onload=()=>{
                try{
                    const target=frame.contentWindow;
                    if(typeof target?.print!=="function")throw new TypeError("Publication print frame does not expose print().");
                    const afterprint=()=>settle(null,true);
                    if(typeof target.addEventListener==="function")listen(target,"afterprint",afterprint);
                    else if(this.#ownerWindow&&this.#ownerWindow!==target)listen(this.#ownerWindow,"afterprint",afterprint);
                    if(typeof target.matchMedia==="function"){
                        const media=target.matchMedia("print");job.media=media;job.sawPrintMedia=Boolean(media.matches);
                        const change=event=>{if(event.matches)job.sawPrintMedia=true;else if(job.sawPrintMedia)settle(null,true);};
                        listen(media,"change",change);
                    }
                    target.focus?.();job.invoked=true;
                    const returned=target.print();
                    if(returned&&typeof returned.then==="function")returned.catch(error=>settle(error));
                    if(!job.settled)job.timer=this.#setTimeout(()=>settle(null,true),this.#fallbackDelay);
                }catch(error){settle(error);}
            };
            frame.onerror=()=>settle(new Error("The authoritative publication print frame failed to load."));
            frame.srcdoc=asset.content;
            this.#document.body.appendChild(frame);
        });
    }
    dispose(){if(this.#disposed)return;this.#disposed=true;for(const job of this.#jobs)if(!job.invoked)job.settle(null,false);}
}
