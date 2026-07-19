import RootNode from "./RootNode";

import TreeNodeButton from "./TreeNodeButton";

import  useTheory  from "../../src/hooks/useTheory";

export default function FamilyNode({ scale }){
    const theory =  useTheory();
   

    const id = `family:${scale.id}`;  




    return(
        <div className="mb-2" >

            <TreeNodeButton open={ theory.isOpen(id) } onClick={()=>theory.toggle(id)}/>
            { open &&
                <div
                    className=" ml-5 mt-1 " >
                    {
                        Object.keys( theory.keys ).map(root=>(
                            <RootNode
                                key={root}
                                scale={scale}
                                root={root}
                            />))
                    }
                </div>
            }
        </div>
    );

}