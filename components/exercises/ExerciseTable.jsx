

export default function ExerciseTable({

    schema,

    rows = [],

    selectedRow = 0,

    onSelectRow

}) {

    if (!schema || rows.length === 0) {

        return (

            <div className="rounded-lg border bg-white p-8 text-center text-slate-500">

                No exercise loaded.

            </div>

        );

    }

    const columns = schema.columns.filter(

        column => column.visible !== false

    );

    return (

        <div
            className="
                overflow-auto
                rounded-lg
                border
                bg-white
            "
        >

            <table className="min-w-full border-collapse">

                <thead>

                    <tr className="border-b bg-slate-100">

                        {

                            columns.map(column => (

                                <th
                                    key={column.id}
                                    style={{ width: column.width }}
                                    className={`
                                        px-4
                                        py-2
                                        text-sm
                                        font-semibold 
                                        ${getAlignment(column)}
                                    `}>

                                    {column.header}
                                </th>

                            ))
                        }
                    </tr>
                </thead>
                <tbody>

                    {

                        rows.map((row,index)=>(

                            <TableRow

                                key={row.id}

                                row={row}

                                columns={columns}

                                selected={

                                    index===selectedRow

                                }

                                onClick={()=>

                                    onSelectRow?.(

                                        index

                                    )

                                }

                            />

                        ))

                    }

                </tbody>

            </table>

        </div>

    );

}

function TableRow({

    row,

    columns,

    selected,

    onClick

}){

    return(

        <tr

            onClick={onClick}

            className={` cursor-pointer
                        border-b
                        transition-colors
                        ${
                            selected
                                ? "bg-blue-100"
                                : "hover:bg-slate-50"
                        }
                    `} >

            {

                columns.map(column=>(

                    <TableCell

                        key={column.id}

                        row={row}

                        column={column}

                    />

                ))

            }

        </tr>

    );

}

function TableCell({

    row,

    column

}){

    let content;

    //------------------------------------------
    // Renderer
    //------------------------------------------

    if(column.renderer){

        const Renderer = column.renderer;

        content = (

            <Renderer

                value={

                    row[column.id]

                }

                row={row}

                column={column}

            />

        );

    }

    //------------------------------------------
    // Render callback
    //------------------------------------------

    else if(column.render){

        content =

            column.render(

                row,

                row[column.id]

            );

    }

    //------------------------------------------
    // Formatter
    //------------------------------------------

    else if(column.format){

        content =

            column.format(

                row[column.id],

                row

            );

    }

    //------------------------------------------
    // Default
    //------------------------------------------

    else{

        content =

            row[column.id];

    }

    return(

        <td

            className={classNames(

                "px-4",

                "py-2",

                "align-top",

                getAlignment(column)

            )}

        >

            {content}

        </td>

    );

}

function getAlignment(column){

    switch(column.align){

        case "center":

            return "text-center";

        case "right":

            return "text-right";

        default:

            return "text-left";

    }

}