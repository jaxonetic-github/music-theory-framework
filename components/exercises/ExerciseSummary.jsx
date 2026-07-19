export default function ExerciseSummary({

    metadata

}) {

    if (!metadata) {

        return null;

    }

    const {

        title,

        subtitle,

        root,

        family,

        exercise,

        notes = [],

        intervals = [],

        formula = [],

        modeName,

        stepCount

    } = metadata;

    return (

        <div className=" rounded-lg border bg-white p-4 space-y-4 ">

            {/* -------------------------------- */}
            {/* Title                           */}
            {/* -------------------------------- */}

            <div>

                <h2
                    className="
                        text-xl
                        font-semibold
                    "
                >

                    {title}

                </h2>

                {

                    subtitle && (

                        <p
                            className="
                                text-sm
                                text-slate-500
                            "
                        >

                            {subtitle}

                        </p>

                    )

                }

            </div>

            {/* -------------------------------- */}
            {/* Metadata Grid                   */}
            {/* -------------------------------- */}

            <div
                className="
                    grid
                    grid-cols-2
                    md:grid-cols-4
                    gap-4
                "
            >

                <SummaryItem
                    label="Root"
                    value={root}
                />

                <SummaryItem
                    label="Family"
                    value={family}
                />

                <SummaryItem
                    label="Exercise"
                    value={exercise}
                />

                <SummaryItem
                    label="Steps"
                    value={stepCount}
                />

                {

                    modeName && (

                        <SummaryItem
                            label="Mode"
                            value={modeName}
                        />

                    )

                }

            </div>

            {/* -------------------------------- */}
            {/* Notes                           */}
            {/* -------------------------------- */}

            <Section
                title="Scale Notes"
            >

                <BadgeRow
                    items={notes}
                />

            </Section>

            {/* -------------------------------- */}
            {/* Intervals                       */}
            {/* -------------------------------- */}

            {

                intervals.length > 0 && (

                    <Section
                        title="Intervals"
                    >

                        <BadgeRow
                            items={intervals}
                        />

                    </Section>

                )

            }

            {/* -------------------------------- */}
            {/* Formula                         */}
            {/* -------------------------------- */}

            {

                formula.length > 0 && (

                    <Section
                        title="Formula"
                    >

                        <BadgeRow
                            items={formula}
                        />

                    </Section>

                )

            }

        </div>

    );

}

/* ======================================================
   Helpers
   ====================================================== */

function SummaryItem({

    label,

    value

}) {

    return (

        <div>

            <div
                className="
                    text-xs
                    uppercase
                    tracking-wide
                    text-slate-500
                "
            >

                {label}

            </div>

            <div
                className="
                    font-medium
                "
            >

                {value}

            </div>

        </div>

    );

}

function Section({

    title,

    children

}) {

    return (

        <div>

            <div
                className="
                    mb-2
                    text-sm
                    font-semibold
                    text-slate-700
                "
            >

                {title}

            </div>

            {children}

        </div>

    );

}

function BadgeRow({

    items

}) {

    return (

        <div
            className="
                flex
                flex-wrap
                gap-2
            "
        >

            {

                items.map(

                    (item,index)=>(

                        <span

                            key={index}

                            className="
                                rounded-md
                                bg-slate-100
                                px-2
                                py-1
                                text-sm
                            "
                        >

                            {item}

                        </span>

                    )

                )

            }

        </div>

    );

}