# Better Lyrics Sync

Show the **current lyric line** from **Dopamine**, **TIDAL**, or **Spotify** as your **Discord custom status** — and give the [Dopamine](https://github.com/digimezzo/dopamine) music player real Discord Rich Presence with per-track cover art.

This repository contains two pieces that work together:

1. **LyricsStatus** — a standalone copy of the `lyricsStatus` plugin from [TestcordDev/Testcord](https://github.com/TestcordDev/Testcord), extended with Dopamine support, automatic player selection, and reliability fixes. Lyrics are fetched from [LRCLIB](https://lrclib.net) and timed against your playback position.
2. **dopamine-rpc-patch** — a small patcher for Dopamine 3 that makes its own Discord RPC carry real cover art and expose the playback clock the plugin uses.

## Features

- Syncs the active lyric line into your Discord custom status
- Playback sources: **Dopamine** (local loopback bridge), **TIDAL** (via TidaLuna / TIDALuna), and **Spotify**
- **Automatic** mode: uses whichever player is playing, Dopamine first
- Dopamine's Discord activity shows the **track's cover art** from Apple's public iTunes catalogue (with the stock icon as fallback), and stays a single, flicker-free activity
- Template support: `{lyrics}`, `{song}`, `{artist}` (default `🎵 {lyrics}`)
- Optional status when playback stops: custom message **or** restore your previous status
- Optional user-area panel toggle button
- Global + per-song lyric delay (shared with TestCord music controls)
- LrcLib exact lookup with a search fallback for hard-to-match tracks
- Rate-limited status writes with a single retry so Discord does not drop updates

## Requirements

- A Discord client mod that loads TestCord plugins ([Testcord](https://github.com/TestcordDev/Testcord))
- For Dopamine: the [Dopamine 3 desktop player](https://github.com/digimezzo/dopamine) plus the `dopamine-rpc-patch` below (the patch is what provides both cover art and the lyric timing clock)
- For TIDAL: [TidaLuna](https://github.com/Inrixia/TidaLuna) installed in the TIDAL desktop app
- For Spotify: Spotify desktop player with the usual client-mod Spotify integration
- Network access to `https://lrclib.net` for synced lyrics (and, for Dopamine covers, to Apple's iTunes search)

## Installation

### 1. Lyrics plugin (TestCord)

Copy the plugin folder into your TestCord checkout so the path matches:

```text
<src>/testcordplugins/lyricsStatus/index.tsx
```

Example for a standard TestCord tree:

```bash
git clone https://github.com/DavidHiFi/better-lyrics-sync.git
cp -r better-lyrics-sync/src/lyricsStatus <TestCord>/src/testcordplugins/lyricsStatus
```

Then rebuild / reinstall your client mod as usual (for TestCord: `pnpm build` and inject, or use your existing dev workflow).

After a rebuild, **fully restart Discord** (quit the process, then start it again). A simple `Ctrl+R` reload can keep serving a cached renderer and will not pick up the new plugin code.

### 2. Dopamine RPC patch (Dopamine users)

See [`dopamine-rpc-patch/README.md`](dopamine-rpc-patch/README.md). Short version, with Dopamine closed:

```bash
cd dopamine-rpc-patch
node patch-asar.cjs audit
node patch-asar.cjs build
node patch-asar.cjs install
```

Then start Dopamine normally. `rollback` restores the original archive at any time.

## Usage

1. Open **TestCord → Plugins → LyricsStatus**.
2. Set **Source** to `Automatic` (recommended), `Dopamine`, `TIDAL`, or `Spotify`.
3. Optionally edit **Format**, stop behaviour, and the panel button.
4. Play a track — the lyric line appears as your custom status while it plays.

### Settings

| Setting | Description |
| --- | --- |
| Format | Status template. `{lyrics}` = current line, `{song}` = track, `{artist}` = artist |
| Source | `Automatic`, `Dopamine`, `TIDAL`, or `Spotify` |
| Custom message on stop | Write a fixed status when music stops or the plugin is disabled |
| Custom message | Text used by the option above (blank clears the status) |
| Restore status on stop | Put back the custom status from before music started |
| Show panel button | Toggle the music-note button in the user area panel |

## How it works

**Lyrics (plugin side):**

1. Every second, read playback from the active source: Dopamine's loopback bridge (`127.0.0.1:35499`, with a Discord-presence fallback), the TIDAL store, or Spotify player events. Automatic mode prefers whichever player is playing, Dopamine first.
2. Fetch synced lyrics for the current track from LRCLIB (cached per track id, exact endpoint first, then the search endpoint).
3. Pick the line matching `position + lyric delay` and write it into your Discord custom status setting, rate-limited and retried once on failure.

**Cover art (Dopamine side, via `dopamine-rpc-patch`):**

1. Dopamine's patched Discord RPC sends its presence immediately on every play, pause, and track change (stock icon — never delayed).
2. An in-app helper looks the cover up in Apple's public iTunes catalogue and resends the same activity with the cover URL through the same RPC connection — one activity, no flicker, and the cover is visible to other users too.
3. The same helper exposes the playback clock on a loopback-only HTTP bridge that the plugin reads for lyric timing.

Without the Dopamine patch the plugin still works for TIDAL and Spotify; Dopamine's activity simply shows its stock icon.

## Credits

- Original **LyricsStatus** plugin by **Sharp** and **x2b** in [TestcordDev/Testcord](https://github.com/TestcordDev/Testcord)
- TestCord / Vencord / Equicord ecosystem
- [LRCLIB](https://lrclib.net) for public synced lyrics
- Apple's public iTunes search for cover art
- [TidaLuna](https://github.com/Inrixia/TidaLuna) for the local TIDAL control API
- [Dopamine](https://github.com/digimezzo/dopamine) by Digimezzo

## License

[GPL-3.0-or-later](LICENSE) — same license as the upstream TestCord source.
