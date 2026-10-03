# StreamEnhancer

TestCord's stream tuning, microphone, preview and viewer-control plugin, forked with two changes.

Copy the source files in this folder to `src/testcordplugins/StreamEnhancer` in a compatible TestCord checkout, replacing the bundled plugin, then build the client. Preserve the original author metadata and license headers. This copy is published as part of the maintained collection. See the root README for installation and validation limits.

Authors: omaw (upstream StreamEnhancer) and DavidHiFi (this fork). License: GPL-3.0-or-later. See LICENSE.

## Fork changes

**Camera preview.** The `REMOTE_VIDEO,paused:` patch renders call-tile cameras through Discord's native `location:"VideoStream"` component. It now keeps Discord's required video CSS class when adding the plugin's fit class, and derives the stream key from the matched participant instead of assuming a minified variable name. Both changes matter for self and remote camera tiles: dropping the native class can leave the video element without its layout dimensions, while a stale stream key prevents the right media state from being applied. The outgoing canvas filter also passes unfiltered camera/share tracks through unchanged and uses a positive capture frame rate when a filter is active, avoiding blank manual-capture tracks on Chromium builds without `requestFrame()`.

**Spoofed stream badge.** The advertised resolution and frame rate of a screen share are separate from encoder settings. The fork carries over Custom Stream Quality's `Spoofed stream badge` controls for width, height and FPS, defaulting to off; for example, encode at 1080p 60 FPS while advertising 7680 × 4320 at 360 FPS. The patches rewrite outgoing stream metadata and the local badge only. Capture resolution, bitrate and camera settings are unchanged.

## Checks

Run `node tests/stream-enhancer.cjs` from the repository root after installing its development dependencies. Offline checks cover spoofed 8K/360 badge metadata without mutating the 1080p/60 encoder values, bounds validation, native self/remote camera rendering, preservation of Discord's video classes, minifier-safe camera stream-key injection, and pass-through of unfiltered camera/share tracks. Set `STREAM_ENHANCER_MODULES` to captured module JSON to check the patches against a live bundle as well. Offline checks do not establish in-game behaviour.
