# Custom Stream Quality for TestCord

A TestCord plugin that sets your screen share's resolution, frame rate, bitrate, codec, keyframe interval and HDR capture. It can also show viewers a different resolution and frame rate on the stream badge, for example 8K 360 FPS while you actually stream 1080p 60.

This is an independent MIT rewrite of TestCord's Custom Stream Quality plugin. It keeps the same plugin name and setting keys, so existing settings carry over.

## What changed from the original

The original's badge spoof had no effect. It edited stream parameters on the local transport, and viewers never receive those. Viewers build the badge from the stream list your client sends to Discord's voice gateway (opcode 12). This version rewrites that message and leaves the local encoder on your real settings.

The other options also moved off hooks that current Discord no longer calls. Checked against Discord Stable and PTB web build 620157 on 2026-09-25.

## Options

| Setting | Effect |
| --- | --- |
| Frame rate, resolution, bitrate | Real encoder settings. Each has its own on/off toggle. |
| Codec | Forces H264, H265, VP8, VP9 or AV1 from your next stream if the voice server offers it. Viewers whose client cannot decode it see no video. |
| Keyframe interval | Milliseconds between keyframes. Zero uses the encoder default. |
| HDR | Requests HDR capture from your next screen share. |
| Spoof badge | Resolution and frame rate shown to viewers and on your own stream tile. Real encoding does not change. |

Changes to anything except codec and HDR apply to a stream that is already live.

The plugin also unlocks Discord's own high quality stream presets without Nitro. Discord's servers can still limit what they relay.

## Install

In PowerShell, with a TestCord source checkout that has its dependencies installed:

```powershell
.\install.ps1 -TestCord "C:\path\to\TestCord"
```

The script backs up the existing `src\testcordplugins\StreamQuality` directory, copies in `src\index.tsx`, `src\quality.ts` and `src\patches.ts`, and runs `pnpm build`. Then fully quit Discord from the tray and start it again. Reloading with Ctrl+R keeps the old bundle.

Enable Custom Stream Quality in TestCord's plugin settings. To check the badge, watch your stream from a second account.

## Tests

From the TestCord checkout:

```sh
npx tsx --test path/to/CustomStreamQuality-UserPlugin/tests/*.test.ts
```

`quality.test.ts` covers the settings logic, including 8K 360 on the badge while encoding stays at 1080p 60. `patches.test.ts` runs every patch against a Discord web bundle. Download the main `web.<hash>.js` from `https://discord.com/app` and point `DISCORD_BUNDLE` at it. The patch test is skipped when `DISCORD_BUNDLE` is unset. Neither test proves what a remote client renders.

## License

MIT. TestCord itself is GPL-3.0. This repository contains no code from TestCord's GPL plugin.
