"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const asar = require(require.resolve("@electron/asar", { paths: ["C:/Users/localuser/Documents/TestCord"] }));

const archive = "H:/System Configuration/.tmp/dopamine-discord/app.asar";
const source = asar.extractFile(archive, "main\\api\\discord\\discord-api.js").toString();
new vm.Script(source);

async function main() {
    const sent = [];
    const current = [];
    const resenders = [];
    let rejectNextLogin = false;
    let retry;
    class Client {
        constructor() { this.handlers = {}; }
        on(event, callback) { this.handlers[event] = callback; }
        login() {
            if (rejectNextLogin) { rejectNextLogin = false; return Promise.reject(new Error("Discord is starting")); }
            queueMicrotask(() => this.handlers.ready?.());
            return Promise.resolve();
        }
        setActivity(activity) { sent.push(activity); return Promise.resolve(); }
        clearActivity() { sent.push(null); return Promise.resolve(); }
    }
    const exports = {};
    const context = {
        exports,
        process: { resourcesPath: "C:/dummy" },
        setTimeout(callback) { retry = callback; return 1; },
        clearTimeout() { retry = undefined; },
        require(name) {
            if (name === "discord-rpc") return { Client };
            if (name === "electron-log") return { default: { info() {}, warn() {}, error() {} } };
            if (name === "node:path") return require("node:path");
            if (name.endsWith("dopamine-discord-artwork.cjs")) return {
                setCurrent(args, resend) { current.push(args.title); resenders.push(resend); },
                clearCurrent() { current.push(null); resenders.push(null); },
            };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    };
    vm.runInNewContext(source, context);
    const api = new exports.DiscordApi("test");
    api._client = new Client();
    api._isReady = true;
    api.setPresence({ title: "Darkness", artists: "Eminem", largeImageKey: "icon", type: 2 });
    assert.equal(sent[0].largeImageKey, "icon");
    assert.equal(current.at(-1), "Darkness");
    assert.equal(typeof resenders.at(-1), "function");

    api.setPresence({ title: "New song", artists: "Artist", largeImageKey: "icon", type: 2 });
    api.clearPresence();
    assert.equal(sent.at(-1), null);
    assert.equal(current.at(-1), null);
    assert.equal(resenders.at(-1), null);

    const replay = new exports.DiscordApi("test");
    replay.reconnect();
    await new Promise(resolve => setImmediate(resolve));
    replay.setPresence({ title: "Reconnected song", artists: "Artist", largeImageKey: "icon", type: 2 });
    const oldClient = replay._client;
    oldClient.handlers.disconnected();
    await new Promise(resolve => setImmediate(resolve));
    assert.notEqual(replay._client, oldClient);
    assert.equal(sent.at(-1).details, "Reconnected song");

    rejectNextLogin = true;
    const retryApi = new exports.DiscordApi("test");
    retryApi._lastPresenceArgs = { title: "Retry song", artists: "Artist", largeImageKey: "icon", type: 2 };
    retryApi.reconnect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof retry, "function");
    retry();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(retryApi._isReady, true);
    assert.equal(sent.at(-1).details, "Retry song");
    console.log("Patched RPC preserves the icon, publishes playback, and retries a failed Discord reconnect.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
