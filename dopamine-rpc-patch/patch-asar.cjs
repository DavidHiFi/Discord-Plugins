"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const asar = require(require.resolve("@electron/asar", { paths: [process.env.TESTCORD_DIR || "C:/Users/localuser/Documents/TestCord"] }));

const root = process.env.DOPAMINE_PATCH_ROOT || "H:/System Configuration";
const resources = process.env.DOPAMINE_RESOURCES || "C:/Users/localuser/AppData/Local/Programs/Dopamine/resources";
const installedAsar = path.join(resources, "app.asar");
const installedHelper = path.join(resources, "dopamine-discord-artwork.cjs");
const sourceHelper = path.join(__dirname, "artwork.cjs");
const stagedAsar = path.join(root, ".tmp/dopamine-discord/app.asar");
const backupDir = path.join(root, "backups/2026-09-27/dopamine-discord");
const backupAsar = path.join(backupDir, "app.asar.before");
const archivePath = "main\\api\\discord\\discord-api.js";
const marker = "dopamine-discord-artwork.cjs";

function sha256(data) { return crypto.createHash("sha256").update(data).digest("hex"); }
function fileHash(file) { return sha256(fs.readFileSync(file)); }
function replaceOne(text, oldText, newText) {
    if (text.split(oldText).length !== 2) throw new Error(`Expected one patch anchor: ${oldText.slice(0, 55)}`);
    return text.replace(oldText, newText);
}

function patchedSource(original) {
    if (original.includes(marker)) throw new Error("The installed archive already has the artwork patch");
    let source = replaceOne(original,
        'const electron_log_1 = require("electron-log");',
        'const electron_log_1 = require("electron-log");\nlet dopamineArtwork;\ntry { dopamineArtwork = require(require("node:path").join(process.resourcesPath, "dopamine-discord-artwork.cjs")); }\ncatch (error) { electron_log_1.default.warn("[DiscordApi] Album artwork helper unavailable", error); }');
    source = replaceOne(source,
        '        this._isReconnecting = true;\n        this._isReady = false;',
        '        this._isReconnecting = true;\n        if (this._lastPresenceArgs && !this._presenceToSetWhenReady) this._presenceToSetWhenReady = this._lastPresenceArgs;\n        this._isReady = false;');
    source = replaceOne(source,
        '            this._isReady = true;\n            if (this._presenceToSetWhenReady) {',
        '            this._isReady = true;\n            if (this._retryTimeout) { clearTimeout(this._retryTimeout); this._retryTimeout = undefined; }\n            if (this._presenceToSetWhenReady) {');
    source = replaceOne(source,
        '            this._isReady = false;\n            this.login();\n        });',
        '            this._isReady = false;\n            this._presenceToSetWhenReady = this._lastPresenceArgs;\n            this.reconnect();\n        });');
    source = replaceOne(source,
        '                electron_log_1.default.error(`[DiscordApi] [login] Failed to log into Discord client: ${error}`);',
        '                electron_log_1.default.error(`[DiscordApi] [login] Failed to log into Discord client: ${error}`);\n                if (this._lastPresenceArgs && !this._retryTimeout) {\n                    this._retryTimeout = setTimeout(() => { this._retryTimeout = undefined; if (!this._isReady) this.reconnect(); }, 3000);\n                }');
    source = replaceOne(source,
        '    setPresence(args) {\n        if (!this._isReady) {',
        '    setPresence(args) {\n        this._lastPresenceArgs = args;\n        if (!this._isReady) {');
    source = replaceOne(source,
        '        this._client.setActivity(presence);',
        '        this._client.setActivity(presence).catch(error => electron_log_1.default.warn("[DiscordApi] Base presence update failed", error));\n        if (dopamineArtwork) dopamineArtwork.setCurrent(args, () => this.setPresence(args));');
    source = replaceOne(source,
        '    clearPresence() {\n        this._presenceToSetWhenReady = undefined;',
        '    clearPresence() {\n        if (dopamineArtwork) dopamineArtwork.clearCurrent();\n        if (this._retryTimeout) { clearTimeout(this._retryTimeout); this._retryTimeout = undefined; }\n        this._lastPresenceArgs = undefined;\n        this._presenceToSetWhenReady = undefined;');
    source = replaceOne(source,
        '    shutdown() {\n        this._presenceToSetWhenReady = undefined;',
        '    shutdown() {\n        if (dopamineArtwork) dopamineArtwork.clearCurrent();\n        if (this._retryTimeout) { clearTimeout(this._retryTimeout); this._retryTimeout = undefined; }\n        this._lastPresenceArgs = undefined;\n        this._presenceToSetWhenReady = undefined;');
    return source;
}

function archiveEntry(header) {
    return header.files.main.files.api.files.discord.files["discord-api.js"];
}

async function build() {
    const baseAsar = asar.extractFile(installedAsar, archivePath).toString("utf8").includes(marker) ? backupAsar : installedAsar;
    if (!fs.existsSync(baseAsar)) throw new Error("The original Dopamine archive backup is missing");
    const raw = asar.getRawHeader(baseAsar);
    const original = asar.extractFile(baseAsar, archivePath).toString("utf8").replace(/\r\n/g, "\n");
    const patched = Buffer.from(patchedSource(original), "utf8");
    const archiveStat = fs.statSync(baseAsar);
    const oldDataOffset = 8 + raw.headerSize;
    const bodyLength = archiveStat.size - oldDataOffset;
    const header = structuredClone(raw.header);
    const entry = archiveEntry(header);
    entry.size = patched.length;
    entry.offset = String(bodyLength);
    entry.integrity = {
        algorithm: "SHA256",
        hash: sha256(patched),
        blockSize: 4194304,
        blocks: [sha256(patched)],
    };
    const json = Buffer.from(JSON.stringify(header), "utf8");
    const padding = (4 - json.length % 4) % 4;
    const headerSize = 8 + json.length + padding;
    const prelude = Buffer.alloc(16);
    prelude.writeUInt32LE(4, 0);
    prelude.writeUInt32LE(headerSize, 4);
    prelude.writeUInt32LE(headerSize - 4, 8);
    prelude.writeUInt32LE(json.length, 12);
    fs.mkdirSync(path.dirname(stagedAsar), { recursive: true });
    fs.writeFileSync(stagedAsar, Buffer.concat([prelude, json, Buffer.alloc(padding)]));
    await pipeline(fs.createReadStream(baseAsar, { start: oldDataOffset }), fs.createWriteStream(stagedAsar, { flags: "a" }));
    fs.appendFileSync(stagedAsar, patched);
    asar.uncacheAll();
    const extracted = asar.extractFile(stagedAsar, archivePath);
    if (!extracted.equals(patched)) throw new Error("Patched source failed the ASAR round trip");
    for (const sample of ["main.js", "package.json", "src\\app\\services\\discord\\discord.service.ts"]) {
        if (!asar.extractFile(stagedAsar, sample).equals(asar.extractFile(baseAsar, sample))) {
            throw new Error(`Unchanged ASAR member differs: ${sample}`);
        }
    }
    console.log(JSON.stringify({ stagedAsar, originalHash: fileHash(baseAsar), stagedHash: fileHash(stagedAsar), helperHash: fileHash(sourceHelper), verified: true }, null, 2));
}

function running() {
    const table = execFileSync("tasklist", ["/FI", "IMAGENAME eq Dopamine.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" });
    return /^"Dopamine\.exe"/im.test(table);
}

function audit() {
    console.log(JSON.stringify({
        installedAsar,
        installedHash: fileHash(installedAsar),
        installedPatched: asar.extractFile(installedAsar, archivePath).toString("utf8").includes(marker),
        helperInstalled: fs.existsSync(installedHelper),
        staged: fs.existsSync(stagedAsar),
        dopamineRunning: running(),
    }, null, 2));
}

function install() {
    if (running()) throw new Error("Dopamine is running. Close it before installing this archive.");
    if (!fs.existsSync(stagedAsar)) throw new Error("Build the archive first");
    if (!asar.extractFile(stagedAsar, archivePath).toString("utf8").includes(marker)) throw new Error("Staged archive lacks the patch");
    fs.mkdirSync(backupDir, { recursive: true });
    if (!fs.existsSync(backupAsar)) fs.copyFileSync(installedAsar, backupAsar);
    fs.copyFileSync(sourceHelper, installedHelper);
    fs.copyFileSync(stagedAsar, installedAsar);
    if (fileHash(stagedAsar) !== fileHash(installedAsar)) {
        fs.copyFileSync(backupAsar, installedAsar);
        throw new Error("Archive install verification failed; original restored");
    }
    console.log(JSON.stringify({ installed: true, installedHash: fileHash(installedAsar), rollback: backupAsar }, null, 2));
}

function rollback() {
    if (running()) throw new Error("Dopamine is running. Close it before restoring the original archive.");
    if (!fs.existsSync(backupAsar)) throw new Error("Original Dopamine archive backup is missing");
    fs.copyFileSync(backupAsar, installedAsar);
    if (fs.existsSync(installedHelper)) fs.unlinkSync(installedHelper);
    if (fileHash(installedAsar) !== fileHash(backupAsar)) throw new Error("Archive rollback verification failed");
    console.log(JSON.stringify({ restored: true, installedHash: fileHash(installedAsar) }, null, 2));
}

async function main() {
    const command = process.argv[2] || "audit";
    if (command === "audit") audit();
    else if (command === "build") await build();
    else if (command === "install") install();
    else if (command === "rollback") rollback();
    else throw new Error("Use audit, build, install, or rollback");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
