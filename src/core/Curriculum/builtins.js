import { Curriculum, ExerciseTemplate, ExerciseTemplateParameter } from "./values.js";

const parameter = value => new ExerciseTemplateParameter(value);
const common = Object.freeze([
    parameter({ id:"root",label:"Root",contract:"root",defaultValue:"C",helpText:"Written root spelling." }),
    parameter({ id:"allKeys",label:"Canonical all keys",contract:"boolean",defaultValue:false }),
    parameter({ id:"direction",label:"Direction",contract:"choice",defaultValue:"ascending",allowedValues:["ascending","descending","ascending-descending"] }),
    parameter({ id:"octaves",label:"Octaves",contract:"integer",defaultValue:1,allowedValues:[1,2] }),
    parameter({ id:"startingOctave",label:"Starting octave",contract:"integer",defaultValue:4,allowedValues:[2,3,4,5,6] }),
    parameter({ id:"duration",label:"Written duration",contract:"duration",defaultValue:{numerator:1,denominator:4},allowedValues:[{numerator:1,denominator:2},{numerator:1,denominator:4},{numerator:1,denominator:8},{numerator:3,denominator:8}] }),
    parameter({ id:"clef",label:"Clef",contract:"choice",defaultValue:"treble",allowedValues:["treble","bass"] }),
    parameter({ id:"timeSignature",label:"Time signature",contract:"object",defaultValue:{beats:4,beatUnit:4},allowedValues:[{beats:4,beatUnit:4},{beats:3,beatUnit:4},{beats:6,beatUnit:8}] }),
    parameter({ id:"measuresPerSystem",label:"Measures per system",contract:"integer",defaultValue:4,allowedValues:[1,2,3,4,6,8] }),
    parameter({ id:"keySignaturePolicy",label:"Key signature",contract:"choice",defaultValue:"none",allowedValues:["none","exercise-root"] }),
    parameter({ id:"layoutProfile",label:"Layout profile",contract:"choice",defaultValue:"print-worksheet",allowedValues:["screen-compact","screen-regular","print-worksheet"] }),
    parameter({ id:"itemLabel",label:"Worksheet item label",contract:"string",required:false })
]);
const scalePattern=parameter({id:"pattern",label:"Scale or mode",contract:"choice",defaultValue:"major",validationSource:"theory.scaleCatalog"});
const chordQuality=parameter({id:"quality",label:"Chord quality",contract:"choice",defaultValue:"major",validationSource:"theory.chordCatalog"});
const target=parameter({id:"target",label:"Chord-member target",contract:"choice",defaultValue:"root",validationSource:"exercise.chordMemberRoles"});
const templates = [
    {id:"major-scales-canonical",name:"Major scales through canonical keys",family:"scale",difficulty:"beginner",objective:"Build fluent major-scale spelling in every canonical key.",tags:["scales","keys","fundamentals"],parameters:[...common.filter(value=>value.id!=="root"),scalePattern],constraints:{pattern:"major",allKeys:true},sectionLabel:"Major scales"},
    {id:"melodic-minor-scales",name:"Melodic minor scales",family:"scale",difficulty:"intermediate",objective:"Develop melodic-minor spelling and directional fluency.",tags:["scales","minor"],parameters:[...common,scalePattern],constraints:{pattern:"melodic-minor"}},
    {id:"scale-thirds",name:"Scale in thirds",family:"scale-thirds",difficulty:"intermediate",objective:"Connect diatonic scale degrees in thirds.",tags:["scales","intervals"],parameters:[...common,scalePattern]},
    {id:"major-triad-arpeggios",name:"Major triad arpeggios",family:"arpeggio-triad",difficulty:"beginner",objective:"Recognize and play written major triads.",tags:["arpeggios","triads"],parameters:[...common,chordQuality],constraints:{quality:"major"}},
    {id:"minor-triad-arpeggios",name:"Minor triad arpeggios",family:"arpeggio-triad",difficulty:"beginner",objective:"Recognize and play written minor triads.",tags:["arpeggios","triads"],parameters:[...common,chordQuality],constraints:{quality:"minor"}},
    {id:"dominant-seventh-arpeggios",name:"Dominant seventh arpeggios",family:"arpeggio-seventh",difficulty:"intermediate",objective:"Internalize dominant-seventh chord spelling.",tags:["arpeggios","sevenths","dominant"],parameters:[...common,chordQuality],constraints:{quality:"dominant-7"}},
    {id:"diatonic-seventh-study",name:"Diatonic seventh-chord study",family:"chord-blocked",difficulty:"intermediate",objective:"Read and compare common seventh-chord qualities.",tags:["harmony","sevenths"],parameters:[...common,chordQuality],defaults:{quality:"major-7"}},
    {id:"chromatic-approach-targets",name:"Chromatic approach notes by target",family:"approach-note",difficulty:"advanced",objective:"Resolve chromatic approaches to selected chord members.",tags:["improvisation","approach-notes"],parameters:[...common,chordQuality,target,parameter({id:"approachPattern",label:"Approach pattern",contract:"choice",defaultValue:"chromatic-below",allowedValues:["chromatic-below","chromatic-above","diatonic-below","diatonic-above"]})],constraints:{direction:"ascending",octaves:1}},
    {id:"enclosure-targets",name:"Enclosure study by target",family:"enclosure",difficulty:"advanced",objective:"Resolve deterministic enclosures to selected chord members.",tags:["improvisation","enclosures"],parameters:[...common,chordQuality,target,parameter({id:"enclosurePattern",label:"Enclosure pattern",contract:"choice",defaultValue:"chromatic-below-above",allowedValues:["chromatic-below-above","chromatic-above-below","diatonic-above-chromatic-below"]})],constraints:{direction:"ascending",octaves:1}},
    {id:"major-ii-v-i",name:"Major ii–V–I progression",family:"chord-progression",difficulty:"intermediate",objective:"Read predominant–dominant–tonic motion in major.",tags:["harmony","progressions"],parameters:[...common,parameter({id:"progression",label:"Progression",contract:"choice",validationSource:"exercise.progressionCatalog"})],constraints:{progression:"ii-v-i-major",direction:"ascending",octaves:1}},
    {id:"minor-ii-v-i",name:"Minor iiø–V–i progression",family:"chord-progression",difficulty:"advanced",objective:"Read minor-key predominant–dominant–tonic motion.",tags:["harmony","progressions","minor"],parameters:[...common,parameter({id:"progression",label:"Progression",contract:"choice",validationSource:"exercise.progressionCatalog"})],constraints:{progression:"ii-half-diminished-v-i-minor",direction:"ascending",octaves:1}},
    {id:"twelve-bar-blues",name:"Twelve-bar dominant blues",family:"chord-progression",difficulty:"advanced",objective:"Follow the harmonic form of a twelve-bar blues.",tags:["harmony","blues","progressions"],parameters:[...common,parameter({id:"progression",label:"Progression",contract:"choice",validationSource:"exercise.progressionCatalog"})],constraints:{progression:"twelve-bar-dominant-blues",direction:"ascending",octaves:1}}
].map(value=>new ExerciseTemplate({...value,description:`Reusable ${value.name.toLowerCase()} worksheet template.`,instructions:"Read the conventional notation and preserve exact written spelling.",version:"1.0.0"}));
export const builtInExerciseTemplates=Object.freeze(templates);

export const builtInCurricula=Object.freeze([
    new Curriculum({id:"beginner-fundamentals",title:"Beginner Fundamentals",description:"Ordered scale and triad foundations.",objective:"Establish written scale and triad fluency.",difficulty:"beginner",tags:["fundamentals"],units:[{id:"foundations",title:"Foundations",objective:"Read core pitch collections.",difficulty:"beginner",lessons:[
        {id:"major-scales",title:"Major scales",objective:"Read all major keys.",difficulty:"beginner",templates:[{templateId:"major-scales-canonical"}]},
        {id:"triads",title:"Major and minor triads",objective:"Compare triad qualities.",difficulty:"beginner",prerequisites:["major-scales"],templates:[{templateId:"major-triad-arpeggios"},{templateId:"minor-triad-arpeggios"}]}
    ]}]}),
    new Curriculum({id:"intermediate-harmony",title:"Intermediate Harmony and Arpeggios",description:"Seventh chords, thirds, and functional harmony.",objective:"Connect scales to chordal harmony.",difficulty:"intermediate",tags:["harmony","arpeggios"],prerequisites:["beginner-fundamentals"],units:[{id:"seventh-harmony",title:"Seventh harmony",objective:"Read seventh chords and progressions.",difficulty:"intermediate",lessons:[
        {id:"thirds-and-sevenths",title:"Thirds and sevenths",objective:"Connect linear and harmonic thirds.",difficulty:"intermediate",templates:[{templateId:"scale-thirds"},{templateId:"dominant-seventh-arpeggios"},{templateId:"diatonic-seventh-study"}]},
        {id:"major-cadence",title:"Major cadence",objective:"Read ii–V–I motion.",difficulty:"intermediate",prerequisites:["thirds-and-sevenths"],templates:[{templateId:"major-ii-v-i"}]}
    ]}]}),
    new Curriculum({id:"advanced-language",title:"Advanced Chromatic Language",description:"Approaches, enclosures, and extended progressions.",objective:"Apply chromatic targeting within harmonic forms.",difficulty:"advanced",tags:["improvisation","chromaticism"],prerequisites:["intermediate-harmony"],units:[{id:"chromatic-language",title:"Chromatic language",objective:"Resolve chromatic lines into harmony.",difficulty:"advanced",lessons:[
        {id:"targets",title:"Approaches and enclosures",objective:"Target chord members chromatically.",difficulty:"advanced",templates:[{templateId:"chromatic-approach-targets"},{templateId:"enclosure-targets"}]},
        {id:"advanced-progressions",title:"Minor cadence and blues",objective:"Read advanced functional forms.",difficulty:"advanced",prerequisites:["targets"],templates:[{templateId:"minor-ii-v-i"},{templateId:"twelve-bar-blues"}]}
    ]}]})
]);
