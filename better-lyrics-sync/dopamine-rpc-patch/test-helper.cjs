"use strict";

const assert = require("node:assert/strict");
process.env.DOPAMINE_DISCORD_PORT = "35500";
const helper = require("./artwork.cjs");

async function main() {
    const resends = [];
    const startTime = Date.now() - 30000;
    helper.setCurrent({ title: "Darkness", artists: "Eminem", shouldSendTimestamps: true, startTime }, () => resends.push(1));
    const url = await helper.lookupArtwork("Darkness", "Eminem");
    assert.match(url, /^https:\/\/[^/]+\.mzstatic\.com\//);
    await new Promise(resolve => setImmediate(resolve));
    let bridged = await (await fetch("http://127.0.0.1:35500/current")).json();
    assert.equal(bridged.artworkUrl, url);
    assert.equal(bridged.startTime, startTime);
    assert.equal(resends.length, 1, "artwork lookup should replay the presence once the cover resolves");
    helper.setCurrent({ title: "Darkness", artists: "Eminem", shouldSendTimestamps: false }, () => resends.push(2));
    bridged = (await (await fetch("http://127.0.0.1:35500/current")).json());
    assert.equal(bridged.playing, false);
    assert.equal(bridged.artworkUrl, url, "the paused cover survives a pause within one track");
    helper.clearCurrent();
    const empty = await (await fetch("http://127.0.0.1:35500/current")).json();
    assert.deepEqual(empty, { title: "", artists: "", playing: false, startTime: 0, artworkUrl: null });
    console.log("Loopback bridge serves the current track, replays presence on cover arrival, and clears when Dopamine stops.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
