import useTheory  from "../../src/hooks/useTheory";
import ExerciseNode from "./ExerciseNode";

import TreeNodeButton from "./TreeNodeButton";

export default function RootNode({ scale, root }){


    const id= `family:${scale.id}/root:${root}`;

    const { isOpen, toggle } = useTheory();

    return(

        <div  className="mb-1">

            <TreeNodeButton open={ isOpen(id) } onClick={()=> toggle(id) } />
            {
                
                <div
                    className=" ml-5 mt-1">
                    {
                        scale.exercises.map(id=>(
                            <ExerciseNode
                                key={id}
                                scale={scale}
                                root={root}
                                exerciseId={id}/>
                        ))
                    }
                </div>
            }
        </div>
    );
}