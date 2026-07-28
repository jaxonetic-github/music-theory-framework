import { ApplicationProvider } from "./ApplicationProvider.jsx";
import { MusicTheoryWebApp } from "./MusicTheoryWebApp.jsx";

function classes(className) {
    return ["music-theory-app", className].filter(Boolean).join(" ");
}

export function MusicTheoryApp({ className, runtime, runtimeFactory, runtimeOptions, accessibilityIdPrefix }) {
    return <div className={classes(className)} data-music-theory-app="v8.9">
        <ApplicationProvider runtime={runtime} bootstrap={runtimeFactory} bootstrapOptions={runtimeOptions}>
            <MusicTheoryWebApp accessibilityIdPrefix={accessibilityIdPrefix} />
        </ApplicationProvider>
    </div>;
}

export default MusicTheoryApp;
