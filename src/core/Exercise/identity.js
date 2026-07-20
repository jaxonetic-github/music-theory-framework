export function identityToken(value) {
    return String(value).replaceAll("#", "-sharp").replaceAll("b", "-flat")
        .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function requestIdentity(request) {
    const roots = request.roots.map(identityToken).join("-");
    return ["exercise", request.type, roots, request.pattern ?? request.quality,
        request.direction, `${request.octaves}oct`, `from${request.startingOctave}`].map(String).join(":");
}
