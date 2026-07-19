export default function Sidebar({

    children

}) {

    return (

        <aside
            className="
            bg-white

            border-r

            overflow-auto
        "
        >

            {children}

        </aside>

    );

}