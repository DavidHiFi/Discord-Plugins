/* Whitespace-only minifier for beautified JS: preserves identifiers, !1, strings. */
function stripWhitespace(src) {
    let out = "";
    let i = 0;
    const n = src.length;
    let prevSignificant = ""; // last significant char emitted
    let pendingSpace = false;
    const isWord = c => /[A-Za-z0-9_$\\]/.test(c);
    const flushSpace = () => { if (pendingSpace) { out += " "; pendingSpace = false; } };
    const emit = c => { flushSpace(); out += c; prevSignificant = c; };
    while (i < n) {
        const c = src[i];
        // comments
        if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
        if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
        if (/\s/.test(c)) { pendingSpace = true; i++; continue; }
        if (pendingSpace) {
            const next = c;
            const p = prevSignificant;
            // decide if the space can be dropped
            const bothWord = isWord(p) && isWord(next);
            const plusPlus = p === "+" && next === "+";
            const minusMinus = p === "-" && next === "-";
            const ltBang = false;
            if (!bothWord && !plusPlus && !minusMinus && !ltBang) { pendingSpace = false; }
            else flushSpace();
        }
        if (c === '"' || c === "'" || c === "`") {
            const quote = c;
            emit(c); i++;
            while (i < n) {
                if (src[i] === "\\") { out += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
                out += src[i];
                if (src[i] === quote) { i++; break; }
                i++;
            }
            prevSignificant = quote;
            continue;
        }
        // drop beautifier-added trailing commas before a closing paren: `f(x,)` === `f(x)`
        if (c === ")" || c === "]") {
            while (out.endsWith(",")) out = out.slice(0, -1);
        }
        emit(c);
        i++;
    }
    return out;
}
module.exports = { stripWhitespace };
