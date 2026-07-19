import ExpandIcon from "./ExpandIcon";

export default function TreeNodeButton({
    open=false,
    label,
    color,
    selected=false,
    selectable=false,
    onClick
}){
    return(

        <button
            onClick={onClick}
            className={`flex items-center gap-2 w-full rounded px-2 py-1 text-left
                ${ selected ?  "bg-blue-600 text-white"  : "hover:bg-slate-100"}
            `} 
        >
            <ExpandIcon open={open} />

            { color && <span className="w-3 h-3 rounded-full" style={{  background:color }} /> }
            {label}
        </button>

    );

}