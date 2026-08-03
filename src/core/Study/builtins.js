import { StudyDefinition } from "./values.js";
const study=(id,name,description,exercises,tags=[])=>new StudyDefinition({id,name,description,exercises,tags,version:"1.0.0"});
export const builtInStudies=Object.freeze([
    study("daily-scale-studies","Daily Scale Studies","Major, minor, modal, and chromatic scale practice.",[
        {family:"scale",pattern:"major"},{family:"scale",pattern:"natural-minor"},{family:"scale",pattern:"harmonic-minor"},{family:"scale",pattern:"melodic-minor"},{family:"scale",pattern:"dorian"},{family:"scale",pattern:"mixolydian"},{family:"scale",pattern:"chromatic"}
    ],["scales","modes"]),
    study("daily-interval-studies","Daily Interval Studies","Diatonic interval patterns using the supported scale-thirds generator.",[{family:"scale-thirds",pattern:"major"},{family:"scale-thirds",pattern:"melodic-minor"}],["intervals"]),
    study("daily-arpeggio-studies","Daily Arpeggio Studies","Triad, seventh-chord, blocked, and broken chord studies.",[
        {family:"arpeggio-triad",quality:"major"},{family:"arpeggio-triad",quality:"minor"},{family:"arpeggio-triad",quality:"diminished"},{family:"arpeggio-triad",quality:"augmented"},{family:"arpeggio-seventh",quality:"dominant-7"},{family:"arpeggio-seventh",quality:"major-7"},{family:"arpeggio-seventh",quality:"minor-7"},{family:"arpeggio-seventh",quality:"half-diminished-7"},{family:"arpeggio-seventh",quality:"diminished-7"},{family:"chord-broken",quality:"major"}
    ],["arpeggios","chords"]),
    study("daily-harmonic-progressions","Daily Harmonic Progression Studies","Functional progression practice from the active progression catalog.",[{family:"chord-progression",progressionFromRequest:true}],["harmony","progressions"]),
    study("full-daily-technical-study","Full Daily Technical Study","A comprehensive independently generated daily technical routine.",[
        {family:"scale",pattern:"major"},{family:"scale",pattern:"natural-minor"},{family:"scale",pattern:"harmonic-minor"},{family:"scale",pattern:"melodic-minor"},{family:"scale-thirds",pattern:"major"},{family:"arpeggio-triad",quality:"major"},{family:"arpeggio-triad",quality:"minor"},{family:"arpeggio-seventh",quality:"dominant-7"},{family:"chord-broken",quality:"major"},{family:"approach-note",quality:"dominant-7",target:"third",approachPattern:"chromatic-below"},{family:"enclosure",quality:"dominant-7",target:"third",enclosurePattern:"chromatic-below-above"},{family:"chord-progression",progressionFromRequest:true}
    ],["daily-study","comprehensive"])
]);
