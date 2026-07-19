export default function Workspace({children}) {

    return (
        <main
            className="
            overflow-auto
            p-6
            space-y-6">
            {children}
        </main>
    );

}