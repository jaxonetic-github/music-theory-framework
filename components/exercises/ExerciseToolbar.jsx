//import { useSettings } from "../../hooks/useSettings";
//import { usePlayback } from "../../hooks/usePlayback";
import  useTheory  from "../../src/hooks/useTheory";

export default function ExerciseToolbar({

    model

}) {

    const {root, family, octave, setOctave} = useTheory();

    //const {settings, setShowNoteNames, setShowIntervals } = useSettings();

    //const { tempo, setTempo, loop, setLoop } = usePlayback();

    return (

        <div
            className="
                flex
                flex-wrap
                items-center
                justify-between
                gap-4

                rounded-lg
                border

                bg-white

                px-4
                py-3
            "
        >

            {/* ---------------------------------- */}
            {/* Exercise Information              */}
            {/* ---------------------------------- */}

            <div>

                <div
                    className="
                        text-lg
                        font-semibold
                    "
                >

                    {model.metadata.title}

                </div>

                <div
                    className="
                        text-sm
                        text-slate-500
                    "
                >

                    {root}

                    {" • "}

                    {family}

                </div>

            </div>

            {/* ---------------------------------- */}
            {/* Controls                          */}
            {/* ---------------------------------- */}

            <div
                className="
                    flex
                    flex-wrap
                    items-center
                    gap-4
                "
            >

                {/* Octave */}

                <label
                    className="
                        flex
                        items-center
                        gap-2
                    "
                >

                    <span>

                        Octaves

                    </span>

                    <select

                        value={octave}

                        onChange={(e)=>

                            setOctave(

                                Number(

                                    e.target.value

                                )

                            )

                        }

                        className="
                            rounded
                            border
                            px-2
                            py-1
                        "

                    >

                        <option value={1}>1</option>

                        <option value={2}>2</option>

                        <option value={3}>3</option>

                        <option value={4}>4</option>

                    </select>

                </label>

                {/* Tempo */}

                <label
                    className="
                        flex
                        items-center
                        gap-2
                    "
                >

                    <span>

                        Tempo

                    </span>

                    <input

                        type="range"

                        min={40}

                        max={200}

                        value={1}

                        onChange={(e)=>

                            setTempo(

                                Number(

                                    e.target.value

                                )

                            )

                        }

                    />

                    <span>

                        {"tempo"}

                    </span>

                </label>

                {/* Loop */}

                <label
                    className="
                        flex
                        items-center
                        gap-2
                    "
                >

                    <input

                        type="checkbox"

                        checked={false}
                        onChange={(e)=>

                            setLoop(

                                e.target.checked

                            )

                        }

                    />

                    Loop

                </label>

                {/* Note Names */}

                <label
                    className="
                        flex
                        items-center
                        gap-2
                    "
                >

                    Note Names

                </label>

                {/* Intervals */}

                <label
                    className="
                        flex
                        items-center
                        gap-2
                    "
                >

                    <input

                        type="checkbox"

                        checked={

                            settings.showIntervals

                        }

                        onChange={(e)=>

                            setShowIntervals(

                                e.target.checked

                            )

                        }

                    />

                    Intervals

                </label>

            </div>

            {/* ---------------------------------- */}
            {/* Export                            */}
            {/* ---------------------------------- */}

            <div
                className="
                    flex
                    gap-2
                "
            >

                <button
                    className="
                        rounded
                        border
                        px-3
                        py-2
                        hover:bg-slate-100
                    "
                >

                    MusicXML

                </button>

                <button
                    className="
                        rounded
                        border
                        px-3
                        py-2
                        hover:bg-slate-100
                    "
                >

                    MIDI

                </button>

                <button
                    className="
                        rounded
                        border
                        px-3
                        py-2
                        hover:bg-slate-100
                    "
                >

                    PDF

                </button>

            </div>

        </div>

    );

}