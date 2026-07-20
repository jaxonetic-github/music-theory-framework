export function identityToken(value) {
    return String(value).replaceAll("#", "-sharp").replaceAll("b", "-flat")
        .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function requestIdentity(request) {
    const roots = request.roots.map(identityToken).join("-");
    const base = ["exercise", request.type, roots, request.pattern ?? request.quality ?? request.progression];
    if (["approach-note", "enclosure"].includes(String(request.type))) base.push(request.approachPattern ?? request.enclosurePattern, request.target);
    return [...base, request.direction, `${request.octaves}oct`, `from${request.startingOctave}`].map(String).join(":");
}
