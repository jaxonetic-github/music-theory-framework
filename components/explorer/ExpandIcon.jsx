export default function ExpandIcon({ open }){

    return(
        <span className="inline-block w-4" >
            { open ? "▼" : "▶" }
        </span>
    );

}