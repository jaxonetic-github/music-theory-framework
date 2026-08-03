import { PluginDescriptor, ServiceDescriptor } from "../Foundation/index.js";
export const publishingServiceDescriptors=Object.freeze({
    engine:new ServiceDescriptor({id:"publishing.engine",name:{value:"publishing-engine",displayName:"Publishing Engine"},description:"Plans and emits deterministic worksheet documents.",layer:"application",category:"application",role:"service",stability:"stable",visibility:"public",capabilities:["deterministic-pagination","html","svg-pages","pdf"]}),
    strategies:new ServiceDescriptor({id:"publishing.strategy-registry",name:{value:"publishing-strategy-registry",displayName:"Publishing Strategy Registry"},description:"Plugin-scoped publication format strategies.",layer:"application",category:"application",role:"registry",stability:"stable",visibility:"public",capabilities:["plugin-isolation","deterministic-selection","safe-replacement"]})
});
export const publishingPluginDescriptor=new PluginDescriptor({id:"core.publishing.builtins",name:{value:"publishing-builtins",displayName:"Built-in Publishing Strategies"},description:"Print-ready HTML, ordered SVG pages, and deterministic vector PDF.",layer:"plugin",category:"plugin",role:"provider",stability:"stable",visibility:"public",capabilities:["print-html","multi-page-svg","vector-pdf"],services:[{id:"publishing.engine",kind:"service"}],extensionPoints:[{id:"publishing.strategy",kind:"exporter"}],metadata:{formats:["html","svg","pdf"],browserRequired:false}});
export const publishingStrategyDescriptors=Object.freeze([
    Object.freeze({id:"html",pluginId:"core.publishing.builtins",format:"html",mediaType:"text/html"}),
    Object.freeze({id:"svg-pages",pluginId:"core.publishing.builtins",format:"svg",mediaType:"image/svg+xml"}),
    Object.freeze({id:"pdf-vector",pluginId:"core.publishing.builtins",format:"pdf",mediaType:"application/pdf"})
]);
