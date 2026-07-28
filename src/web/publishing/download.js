export function downloadPublishedAsset(asset,{document:documentValue=globalThis.document,URL:URLValue=globalThis.URL}={}){
    if(!asset||!documentValue?.createElement||!URLValue?.createObjectURL||!URLValue?.revokeObjectURL)throw new TypeError("Publishing download requires browser document and URL adapters.");
    const blob=new Blob([asset.content],{type:asset.mediaType}),url=URLValue.createObjectURL(blob);
    try{const anchor=documentValue.createElement("a");anchor.href=url;anchor.download=asset.filename;anchor.rel="noopener";anchor.click();}finally{URLValue.revokeObjectURL(url);}
}
export function printPublication({document:documentValue=globalThis.document,window:windowValue=globalThis.window}={}){
    if(!documentValue?.documentElement||typeof windowValue?.print!=="function")throw new TypeError("Publication printing requires a browser document and window.");
    documentValue.documentElement.classList.add("publishing-print-active");
    try{windowValue.print();}finally{documentValue.documentElement.classList.remove("publishing-print-active");}
}
