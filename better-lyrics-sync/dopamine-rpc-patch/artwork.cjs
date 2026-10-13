"use strict";

const https = require("node:https");
const http = require("node:http");
const path = require("node:path");

const lookupCache = new Map();
const LOOKUP_CACHE_MAX = 500;
const port = Number(process.env.DOPAMINE_DISCORD_PORT || 35499);
let albumStatement;
let current = null;

// Discord RPC accepts either an uploaded asset key or a direct image URL for
// the large image, so a resolved artwork URL can be sent as-is.
function applyArtwork(args, url) {
    if (!args || typeof args !== "object" || !url || args.largeImageKey === url) return false;
    try {
        args.largeImageKey = url;
        return true;
    } catch {
        return false; // frozen or sealed args object
    }
}

function normalize(value) {
    return String(value || "").normalize("NFKD").toLowerCase()
        .replace(/\([^)]*(?:remaster|version|edit|mix|deluxe|live)[^)]*\)/g, "")
        .replace(/\b(feat\.?|ft\.?)\b.*$/g, "")
        .replace(/[^a-z0-9]+/g, " ").trim();
}

function getAlbum(title, artist) {
    try {
        if (!albumStatement) {
            const Database = require(path.join(process.resourcesPath, "app.asar", "node_modules", "better-sqlite3"));
            const { app } = require("electron");
            const db = new Database(path.join(app.getPath("userData"), "Dopamine.db"), { readonly: true, fileMustExist: true });
            albumStatement = db.prepare("SELECT AlbumTitle, Artists FROM Track WHERE TrackTitle = ?");
        }
        const rows = albumStatement.all(title);
        return (rows.find(row => normalize(row.Artists).includes(normalize(artist))) || rows[0])?.AlbumTitle || "";
    } catch {
        return "";
    }
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { "User-Agent": "Dopamine Discord artwork" }, timeout: 5000 }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`Artwork search returned ${response.statusCode}`));
                return;
            }
            let body = "";
            response.setEncoding("utf8");
            response.on("data", chunk => {
                body += chunk;
                if (body.length > 1024 * 1024) request.destroy(new Error("Artwork search response too large"));
            });
            response.on("end", () => {
                try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
            });
        });
        request.on("timeout", () => request.destroy(new Error("Artwork search timed out")));
        request.on("error", reject);
    });
}

async function findArtwork(title, artists) {
    const artist = String(artists).split(/[;,]/)[0].trim();
    const album = getAlbum(title, artist);
    const query = new URL("https://itunes.apple.com/search");
    query.searchParams.set("term", `${artist} ${title}`);
    query.searchParams.set("entity", "song");
    query.searchParams.set("country", "AU");
    query.searchParams.set("limit", "50");
    const data = await getJson(query);
    const trackKey = normalize(title);
    const artistKey = normalize(artist);
    const albumKey = normalize(album);
    const matches = (data.results || []).filter(row =>
        normalize(row.trackName) === trackKey &&
        (normalize(row.artistName).includes(artistKey) || artistKey.includes(normalize(row.artistName))) &&
        /^https:\/\/[^/]*\.mzstatic\.com\//.test(row.artworkUrl100 || ""),
    );
    matches.sort((a, b) => Number(normalize(b.collectionName) === albumKey) - Number(normalize(a.collectionName) === albumKey));
    return matches[0]?.artworkUrl100?.replace(/\/100x100bb\./, "/600x600bb.") || null;
}

function lookupArtwork(title, artists) {
    const key = `${normalize(title)}|${normalize(artists)}`;
    if (!key || key === "|") return Promise.resolve(null);
    if (!lookupCache.has(key)) {
        // Unbounded growth leaked a promise per track for the whole session.
        if (lookupCache.size >= LOOKUP_CACHE_MAX) {
            lookupCache.delete(lookupCache.keys().next().value);
        }
        lookupCache.set(key, findArtwork(title, artists).catch(() => null));
    }
    return lookupCache.get(key);
}

// Replay through Dopamine's existing RPC client when the image changes.
function setCurrent(args, resend) {
    const key = `${args.title}|${args.artists}`;
    const playing = !!args.shouldSendTimestamps;
    // The cover is resolved once per track, so it has to survive a pause and
    // resume inside that track instead of being cleared by the new state.
    const sameTrack = current && current.key === key;
    const knownArtwork = sameTrack ? current.artworkUrl : null;
    const update = current = {
        key,
        title: args.title,
        artists: args.artists,
        playing,
        startTime: playing && !args.startTime ? 0 : (playing ? args.startTime || 0 : 0),
        artworkUrl: knownArtwork,
    };
    // The patched RPC callback closes over args. Mutate its image before replay,
    // and skip replay when it already carries the cover to avoid recursion.
    if (knownArtwork && typeof resend === "function" && applyArtwork(args, knownArtwork)) {
        try { resend(args); } catch { /* Dopamine retries its RPC connection. */ }
    }

    lookupArtwork(args.title, args.artists).then(url => {
        // A later pause, track change or clear invalidates this update, even if
        // the later update happens to have the same song title and artist.
        if (current !== update) return;
        update.artworkUrl = url || null;
        if (typeof resend === "function" && applyArtwork(args, url)) {
            try { resend(args); } catch { /* Dopamine retries its RPC connection. */ }
        }
    });
}

function clearCurrent() { current = null; }

const server = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "https://discord.com");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Private-Network", "true");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    if (request.method === "GET" && request.url === "/current") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            title: current?.title || "",
            artists: current?.artists || "",
            playing: !!current?.playing,
            startTime: current?.startTime || 0,
            artworkUrl: current?.artworkUrl || null,
        }));
        return;
    }
    response.writeHead(404); response.end();
});
server.on("error", error => {
    // Swallowing this silently left a dead bridge with no explanation anywhere
    // (a port already in use was the usual cause).
    console.warn(`[dopamine-discord-artwork] bridge unavailable on 127.0.0.1:${port}: ${error?.message ?? error}`);
});
server.listen(port, "127.0.0.1");
server.unref();

module.exports = { setCurrent, clearCurrent, lookupArtwork };
