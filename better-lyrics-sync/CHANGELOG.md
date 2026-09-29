# Changelog

## Unreleased

### Added
- **Dopamine source**: the plugin reads the loopback bridge (`127.0.0.1:35499`) published by the patched Dopamine RPC, with a Discord-presence fallback when the bridge is unavailable.
- **Automatic source mode**: uses whichever player is playing, Dopamine first (explicit `Dopamine` / `TIDAL` / `Spotify` choices remain). Legacy `tidal` selections migrate to `auto` on start.
- **Dopamine RPC patch** (`dopamine-rpc-patch/`): makes Dopamine's own Discord RPC the single presence writer — stock icon immediately, then one resend with the iTunes catalogue cover once the lookup resolves. Also exposes the playback clock bridge and reconnect/retry robustness, with `audit`/`build`/`install`/`rollback` commands and offline tests.
- LrcLib **search fallback** after an exact lookup miss (404 on the exact endpoint no longer hides synced results).

### Changed
- Lyric tick and bridge poll tightened from 2 s to **1 s** (worst-case line-change lag halved).
- Dopamine playback position falls back to the last known position while paused, instead of resetting to zero.
- Status writes: rate-limited (1500 ms), retried once, and logged on failure (prevents Discord from silently dropping updates).
- `format` self-heals to `🎵 {lyrics}` if a stored value is corrupted.
- Startup is wrapped and logged (`Started (source=…, active=…)`).

### Fixed
- No more **cover flicker / duplicate Dopamine activity cards**: the plugin no longer publishes a second local Discord activity; Dopamine's RPC is the only presence writer.

## Prior history

- Inherited from TestCord `src/testcordplugins/lyricsStatus` (GPL-3.0-or-later): Spotify lyric status, custom message on stop, restore status on stop, user-area panel button, shared lyric delay with music controls.
- TIDAL source via TidaLuna / `TidalStore`, `resolveSource()` fallback, custom-status format corruption fix, rate-limit friendly status writes, interval cleanup across start/stop cycles.
