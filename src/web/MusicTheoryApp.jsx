import { ApplicationProvider } from "./ApplicationProvider.jsx";
import { MusicTheoryWebApp } from "./MusicTheoryWebApp.jsx";

function classes(className) {
    return ["music-theory-app", className].filter(Boolean).join(" ");
}

export function MusicTheoryApp({ className, runtime, runtimeFactory, runtimeOptions }) {
    return <div className={classes(className)} data-music-theory-app="v8.7">
        <ApplicationProvider runtime={runtime} bootstrap={runtimeFactory} bootstrapOptions={runtimeOptions}>
            <MusicTheoryWebApp />
        </ApplicationProvider>
    </div>;
}

export default MusicTheoryApp;
