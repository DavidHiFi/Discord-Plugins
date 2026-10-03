# StreamEnhancer

TestCord's stream tuning, microphone, preview and viewer-control plugin, forked with two changes.

Copy the source files in this folder to `src/testcordplugins/StreamEnhancer` in a compatible TestCord checkout, replacing the bundled plugin, then build the client. Preserve the original author metadata and license headers. This copy is published as part of the maintained collection. See the root README for installation and validation limits.

Authors: omaw (upstream StreamEnhancer) and DavidHiFi (this fork). License: GPL-3.0-or-later. See LICENSE.

## Fork changes

**Native camera previews.** Discord's call tile renders cameras through its own `VideoStream` component. The `REMOTE_VIDEO,paused:` patch captures that component directly at the call site and hands it to `$self.renderZoomableCameraVideo`, which threads the fork's fit, zoom and filter props into it. Because the component comes from the call site itself, camera tiles never depend on a global webpack lookup: on a build where the `location:"VideoStream"` code string has changed, the tile still renders exactly what Discord would have rendered, and a lookup that soft-misses can no longer blank out self and remote cameras. Discord's own tile classes are merged, never replaced, so the video keeps its native layout, and every replacement in the tile patches stands on its own — if one stops matching on a future build, the remaining ones keep the tile rendering instead of throwing. An upstream variant of this fork resolved the zoom module to the `StreamTile` component, which expects stream props, so the local camera preview stayed blank while viewers still received frames.

**Spoofed stream badge.** The advertised resolution and frame rate of a screen share are separate from the encoder settings. The fork carries over the Custom Stream Quality badge controls as a `Spoofed stream badge` settings section with width, height and FPS, defaulting to off (defaults when enabled: 7680x4320 at 360 FPS). Three paths feed the values in:

- `this._sentVideo` rewrites the outgoing voice-gateway video parameters on Go Live connections only (`context === "stream"`), so viewers see the spoofed badge while your real capture, bitrate and camera quality stay untouched. Audio entries and non-stream connections pass through unmodified.
- `"useMaxQuality"` updates your own stream tile so it shows the same spoofed values as viewers see.
- The resolution label uses the spoofed height. The `maxResolution.type` uses Discord's own `"fixed"` enum value.

## Checks

Run `node tests/stream-enhancer.cjs` from the repository root after installing its development dependencies. The checks cover badge isolation from the real encoder config, clamping of invalid values, the native camera render for both self and remote (including the preserved Discord classes and the fallback when no captured component exists), a compile gate over all plugin sources, and — when `STREAM_ENHANCER_MODULES` points at a captured module JSON — each tile and badge patch against that captured live code.

`node tools/verify-live-modules.cjs` goes further: it executes the plugin's actual patches against captured Discord chunks and runs the real plugin runtime through them. Point `STREAM_ENHANCER_BUNDLE_DIR` at a folder containing the captured chunk files (call-tile camera, `VideoStream`, stream tile, stream badge helpers, RTC connection) to verify the full render of camera tiles, Go Live tiles and the badge spoof without starting the client. These checks run offline and do not establish in-game behaviour.
