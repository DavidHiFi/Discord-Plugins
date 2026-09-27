# Dopamine RPC patch

Patches the Dopamine 3 desktop app so its own Discord RPC becomes the single
presence writer with real cover art:

1. On play, pause, or track change, Dopamine publishes its presence immediately
   with its stock icon (so playback state updates are never delayed).
2. A helper inside Dopamine's main process looks the cover up in Apple's public
   iTunes catalogue (matched against the local library's album name) and, when
   found, **resends the same presence through the same RPC client** with the
   cover URL as the large image. One activity, no flicker, and the cover is
   also visible to other users.
3. The helper also serves current playback state (title, artists, playing,
   start time, artwork URL) on a loopback-only HTTP bridge at
   `http://127.0.0.1:35499/current`. The [LyricsStatus plugin](../src/lyricsStatus)
   uses that as its playback clock for lyric timing; it never publishes its own
   Discord activity.

Reconnect robustness: the patched `DiscordApi` retries failed logins, replays
the last presence on reconnect, and keeps a failed lookup from sticking
(negative lookups are retried after 60 seconds).

## Install

Requires Node.js. Close Dopamine first, then run from this folder:

```bash
node patch-asar.cjs audit     # read-only: what is installed right now
node patch-asar.cjs build     # patch the original archive into .tmp staging
node patch-asar.cjs install   # swap the patched archive + helper into Dopamine
node patch-asar.cjs rollback  # restore the original archive
```

Then start Dopamine normally. The original `app.asar` is backed up before the
first install; `install` verifies the written archive and restores the backup
automatically if verification fails.

Defaults match this repository author's machine. Override them with
environment variables:

| Variable | Meaning | Default |
| --- | --- | --- |
| `DOPAMINE_RESOURCES` | Dopamine's `resources` directory | `C:\Users\localuser\AppData\Local\Programs\Dopamine\resources` |
| `DOPAMINE_PATCH_ROOT` | Workspace root for `.tmp` staging and backups | `H:\System Configuration` |
| `TESTCORD_DIR` | Any checkout with `@electron/asar` installed (used to patch the archive) | `C:\Users\localuser\Documents\TestCord` |
| `DOPAMINE_DISCORD_PORT` | Loopback bridge port | `35499` |

`install` also copies `artwork.cjs` into Dopamine's `resources` as
`dopamine-discord-artwork.cjs`. After a Dopamine application update, run
`rollback` against the new version's original archive first, then rebuild.

## Tests

```bash
node test-patch.cjs    # patched RPC class: resend hook, replay, failed reconnect retry
node test-helper.cjs   # helper: iTunes lookup, presence replay once, bridge payload
node check-bridge.js   # live probe of the running bridge (Dopamine must be running)
```

## Notes

- Cover art comes from Apple's public iTunes catalogue; no local audio or
  embedded artwork is uploaded anywhere. Tracks without a public catalogue
  match (or with untagged filenames) keep Dopamine's stock icon.
- The bridge listens on `127.0.0.1` only and sets CORS for `https://discord.com`
  so the plugin's renderer can read it.
