#!/usr/bin/env node
"use strict";

// Live probe of the loopback bridge published by the Dopamine RPC patch.
// Usage: node check-bridge.js [port]     (default 35499, or DOPAMINE_DISCORD_PORT)

const port = Number(process.argv[2] || process.env.DOPAMINE_DISCORD_PORT || 35499);
const url = `http://127.0.0.1:${port}/current`;

(async () => {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        const current = await response.json().catch(() => ({}));
        console.log(JSON.stringify({
            reachable: response.ok,
            url,
            title: current.title ?? "",
            artists: current.artists ?? "",
            playing: current.playing ?? false,
            hasArtworkUrl: !!current.artworkUrl,
        }, null, 2));
        if (!response.ok) process.exitCode = 1;
    } catch (error) {
        // Was previously swallowed: this returned a value nobody printed.
        console.log(JSON.stringify({ reachable: false, url, error: String(error) }, null, 2));
        process.exitCode = 1;
    }
})();
