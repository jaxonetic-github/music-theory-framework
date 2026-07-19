export function freezeDeep(v,seen=new WeakSet()){if(v===null||!(typeof v==="object"||typeof v==="function")||seen.has(v)||Object.isFrozen(v))return v;seen.add(v);for(const k of Reflect.ownKeys(v))freezeDeep(v[k],seen);return Object.freeze(v)}
export default freezeDeep;
