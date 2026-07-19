import { createRoot } from "react-dom/client";
import { ApplicationProvider } from "./ApplicationProvider.jsx";
import { MusicTheoryWebApp } from "./MusicTheoryWebApp.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
    <ApplicationProvider><MusicTheoryWebApp /></ApplicationProvider>
);
