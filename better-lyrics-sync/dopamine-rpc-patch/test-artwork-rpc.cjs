"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const asar = require(require.resolve("@electron/asar", { paths: [process.env.TESTCORD_DIR || "C:/Users/localuser/Documents/TestCord"] }));
const archive = process.env.DOPAMINE_TEST_ASAR || "C:/Users/localuser/AppData/Local/Programs/Dopamine/resources/app.asar";
const rpcSource = asar.extractFile(archive, "main\\api\\discord\\discord-api.js").toString();
const helperSource = fs.readFileSync(path.join(__dirname, "artwork.cjs"), "utf8");

function fixture() {
    const pending = [];
    const sent = [];
    const helperModule = { exports: {} };
    vm.runInNewContext(helperSource, {
        module: helperModule, process: { env: {} }, URL, console,
        require(name) {
            if (name === "node:path") return path;
            if (name === "node:http") return { createServer: () => ({ on() {}, listen() {}, unref() {} }) };
            if (name === "node:https") return {
                get(url, options, callback) {
                    const request = new EventEmitter();
                    request.destroy = () => {};
                    pending.push(results => {
                        const response = new EventEmitter();
                        response.statusCode = 200;
                        response.setEncoding = () => {};
                        callback(response);
                        response.emit("data", JSON.stringify({ results }));
                        response.emit("end");
                    });
                    return request;
                },
            };
            throw new Error("No database in this offline fixture");
        },
    });
    const exports = {};
    vm.runInNewContext(rpcSource, {
        exports, process: { resourcesPath: "fixture" },
        require(name) {
            if (name === "node:path") return path;
            if (name === "discord-rpc") return {};
            if (name === "electron-log") return { default: { info() {}, warn() {}, error() {} } };
            if (name.endsWith("dopamine-discord-artwork.cjs")) return helperModule.exports;
            throw new Error(name);
        },
    });
    const api = new exports.DiscordApi("fixture");
    api._isReady = true;
    api._client = {
        setActivity(activity) {
            assert.ok(sent.length < 20, "artwork replay must not recurse indefinitely");
            sent.push(activity);
            return Promise.resolve();
        },
        clearActivity() { sent.push(null); },
    };
    return { api, pending, sent };
}

const cover = "https://is1-ssl.mzstatic.com/image/thumb/test/100x100bb.jpg";
const expected = cover.replace("100x100", "600x600");
const result = title => [{ trackName: title, artistName: "Artist", artworkUrl100: cover }];
const args = (title, playing = true) => ({ title, artists: "Artist", largeImageKey: "icon", shouldSendTimestamps: playing, startTime: 123000, type: 2 });
const flush = () => new Promise(resolve => setImmediate(resolve));

async function main() {
    const f = fixture();
    f.api.setPresence(args("Song"));
    assert.equal(f.sent.at(-1).largeImageKey, "icon");
    f.pending.shift()(result("Song"));
    await flush();
    assert.equal(f.sent.at(-1).largeImageKey, expected, "the actual RPC payload must contain the cover");
    assert.equal(f.sent.at(-1).startTimestamp, 123);
    for (const playing of [false, true, true, false]) {
        f.api.setPresence(args("Song", playing));
        await flush();
        assert.equal(f.sent.at(-1).largeImageKey, expected, "fresh play/pause arguments must retain artwork");
        assert.equal(f.sent.at(-1).startTimestamp, playing ? 123 : undefined);
    }
    f.api.setPresence(args("No cover"));
    f.pending.shift()([]);
    await flush();
    assert.equal(f.sent.at(-1).largeImageKey, "icon", "missing artwork retains the fallback");

    const race = fixture();
    race.api.setPresence(args("Song"));
    race.api.setPresence(args("Song", false));
    race.pending.shift()(result("Song"));
    await flush();
    assert.equal(race.sent.at(-1).largeImageKey, expected);
    assert.equal(race.sent.at(-1).startTimestamp, undefined, "lookup must not replay stale playing state");
    race.api.setPresence(args("Old"));
    race.api.setPresence(args("New"));
    race.pending.shift()(result("Old"));
    await flush();
    assert.equal(race.sent.at(-1).details, "New", "old lookup must not replay a previous song");
    assert.equal(race.sent.at(-1).largeImageKey, "icon");
    race.api.clearPresence();
    race.pending.shift()(result("New"));
    await flush();
    assert.equal(race.sent.at(-1), null, "late artwork must not revive stopped playback");
    console.log("PASS: real patched RPC receives artwork, retains it through play/pause, avoids recursion and stale replay, and preserves the missing-cover fallback.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
