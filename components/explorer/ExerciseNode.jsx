
import  useTheory  from "../../src/hooks/useTheory";

import ModeNode from "./ModeNode";

import TreeNodeButton from "./TreeNodeButton";

export default function ExerciseNode({ scale, root, exerciseId }){


    const theory =  useTheory();

    const exercise = theory.exercises[  exerciseId ];

    const id = `family:${scale.id}/root:${root}/exercise:${exercise.id}`;
    
    return(

        <div className="mb-1" >

            <TreeNodeButton

                open={ exerciseId==="modes" }

                label={exercise.label}

                selectable

                selected={
                    theory.family===scale.id &&
                    theory.root===root &&
                    theory.exercise===exerciseId
                }

                onClick={()=>{

                    theory.setFamily( scale.id);
                    theory.setRoot( root );
                    theory.setExercise( exerciseId );
                    theory.setMode(1);

                    if( exerciseId==="modes" ){
                        setOpen( !open );
                    }
                }}
            />

            {
                exerciseId==="modes" && scale.supportsModes && open
                &&
                <div className=" ml-5 mt-1 ">
                    {
                        scale.modeNames.map(
                            (
                                mode,
                                index
                            )=>( <ModeNode  key={mode} mode={mode} index={ index+1 }/>)

                        )
                    }
                </div>
            }
        </div>
    );

}