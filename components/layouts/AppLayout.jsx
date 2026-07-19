export default function AppLayout({
    children
}) {

    return (

        <div
            className="
            h-screen
            grid
            grid-cols-[320px_1fr]
            grid-rows-[64px_1fr_30px_28px]
            bg-slate-100"
        >

              {children}

        </div>

    );

}