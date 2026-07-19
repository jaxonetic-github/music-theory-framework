import  useTheory  from "../../src/hooks/useTheory.js";

export default function ModeNode({ mode, index }){

    const theory = useTheory();

    return(
        <button
            className={`block w-full text-left rounded px-2 py-1 text-sm ${ theory.mode===index ? "bg-green-500 text-white" :  "hover:bg-slate-100" }`}
            onClick={()=>{ theory.setMode( index ); }}>
                 {index } . { mode }
        </button>
    );

}