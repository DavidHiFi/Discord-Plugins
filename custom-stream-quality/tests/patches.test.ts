// Runs each patch against a downloaded Discord web bundle, the way TestCord applies it.
// Set DISCORD_BUNDLE to the path of Discord's main web.<hash>.js file. Skipped when unset.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { patches } from "../src/patches";

const bundlePath = process.env.DISCORD_BUNDLE;
const bundle = bundlePath && existsSync(bundlePath) ? readFileSync(bundlePath, "utf8") : null;

// TestCord's \i: one JavaScript identifier.
function canonical(match: RegExp): RegExp {
    return new RegExp(match.source.replaceAll(/(\\*)\\i/g, (m, slashes) => slashes.length % 2 === 0 ? `${slashes}(?:[A-Za-z_$][\\w$]*)` : m.slice(1)), match.flags);
}

function modules(code: string): string[] {
    const starts = [...code.matchAll(/(?<=[,{])\d+\(e,t,n\)\{"use strict"/g)].map(m => m.index!);
    return starts.map((start, i) => code.slice(start, starts[i + 1] ?? code.length));
}

test("every patch finds one module and each replacement changes it once", { skip: bundle ? false : "set DISCORD_BUNDLE" }, () => {
    const all = modules(bundle!);
    for (const patch of patches) {
        const found = all.filter(m => m.includes(patch.find));
        assert.equal(found.length, 1, `find ${patch.find} matched ${found.length} modules`);
        let code = found[0];
        for (const r of ([] as any[]).concat(patch.replacement)) {
            const match = canonical(r.match);
            assert.equal([...code.matchAll(new RegExp(match.source, "g"))].length, 1, `${r.match} in ${patch.find}`);
            const next = code.replace(match, r.replace.replaceAll("$self", "Vencord.Plugins.plugins.CustomStreamQuality"));
            assert.notEqual(next, code);
            code = next;
        }
        assert.doesNotThrow(() => new Function(`return {${code}}`), `patched ${patch.find} no longer parses`);
    }
});
