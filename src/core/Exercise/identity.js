export function identityToken(value) {
    return String(value).replaceAll("#", "-sharp").replaceAll("b", "-flat")
        .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function requestIdentity(request) {
    const roots = request.roots.map(identityToken).join("-");
    const base = ["exercise", request.type, roots, request.pattern ?? request.quality ?? request.progression];
    if (["approach-note", "enclosure"].includes(String(request.type))) base.push(request.approachPattern ?? request.enclosurePattern, request.target);
    if(String(request.type)==="chord-progression")base.push(request.realization,`inv${request.inversion}`,request.harmonicRhythm,request.annotationPolicy);
    return [...base, request.direction, `${request.octaves}oct`, `from${request.startingOctave}`].map(String).join(":");
}
