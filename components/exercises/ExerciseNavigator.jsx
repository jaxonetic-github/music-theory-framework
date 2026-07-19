import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight
} from "lucide-react";

export default function ExerciseNavigator({

    currentIndex,

    rowCount,

    onPrevious,

    onNext,

    onFirst,

    onLast

}) {

    const isFirst = currentIndex === 0;

    const isLast = currentIndex >= rowCount - 1;

    return (

        <div
            className="
                flex
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

            <div
                className="
                    flex
                    items-center
                    gap-2
                "
            >

                <button

                    onClick={onFirst}

                    disabled={isFirst}

                    className="
                        rounded
                        border
                        p-2
                        hover:bg-slate-100
                        disabled:opacity-40
                    "

                >

                    <ChevronsLeft size={18} />

                </button>

                <button

                    onClick={onPrevious}

                    disabled={isFirst}

                    className="
                        rounded
                        border
                        p-2
                        hover:bg-slate-100
                        disabled:opacity-40
                    "

                >

                    <ChevronLeft size={18} />

                </button>

            </div>

            <div
                className="
                    flex
                    flex-col
                    items-center
                "
            >

                <span
                    className="
                        text-sm
                        text-slate-500
                    "
                >

                    Exercise Step

                </span>

                <span
                    className="
                        text-lg
                        font-semibold
                    "
                >

                    {currentIndex + 1}

                    {" / "}

                    {rowCount}

                </span>

            </div>

            <div
                className="
                    flex
                    items-center
                    gap-2
                "
            >

                <button

                    onClick={onNext}

                    disabled={isLast}

                    className="
                        rounded
                        border
                        p-2
                        hover:bg-slate-100
                        disabled:opacity-40
                    "

                >

                    <ChevronRight size={18} />

                </button>

                <button

                    onClick={onLast}

                    disabled={isLast}

                    className="
                        rounded
                        border
                        p-2
                        hover:bg-slate-100
                        disabled:opacity-40
                    "

                >

                    <ChevronsRight size={18} />

                </button>

            </div>

        </div>

    );

}