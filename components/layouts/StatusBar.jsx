import  useTheory  from "../../src/hooks/useTheory";

export default function StatusBar() {

    const { root, family,exercise, mode} = useTheory();

    return (

        <div
            className="col-span-2 border-t bg-white px-4 text-sm flex items-center">
            Root:
            <span className="ml-2 font-semibold"> {root} </span>

            <span className="mx-4"> | </span>

            Family:

            <span className="ml-2 font-semibold"> {family} </span>

            <span className="mx-4"> | </span>

            Exercise:

            <span className="ml-2 font-semibold">{exercise}</span>
            
            <span className="mx-4"> | </span>

            Mode:
            <span className="ml-2 font-semibold"> {mode} </span>

        </div>

    );

}