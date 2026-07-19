import FamilyNode from "./FamilyNode";

export default function ExplorerTree({ registry}){
    return(
        <div className="p-3">
            {
                Object.values( registry.scales ).map(scale=>( <FamilyNode key={scale.id} scale={scale} /> ))
            }
        </div>
    );
}