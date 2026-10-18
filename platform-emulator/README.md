# PlatformEmulator

Spoofs the Discord platform your client reports, so other people see the device you pick instead of the one you are on. Fork of TestCord's PlatformEmulator by SirPhantom89 (dx) and x2b, extended by DavidHiFi. GPL-3.0-or-later, the same license as the original.

## What the fork adds

The original plugin only changes what other people see. With Show Own Spoofed on, your own client shows the spoofed platform icon in the same places everyone else sees it: your profile, your messages, the member list and the voice channel user list. The icon uses the same shape and status color as Vencord's PlatformIndicators, so a spoofed VR headset shows the VR headset icon everywhere.

The toggle is off by default and does not need a client restart. Changing the spoofed platform still needs the gateway to reconnect, which the plugin's `verify-os` command triggers.

## Install

Copy `index.tsx` into `src/testcordplugins/PlatformEmulator` in a TestCord source checkout and build with the client's documented commands. The plugin needs the TestCord dev2 tree; other clients need the imports adapted.

## Credits

- SirPhantom89 (dx, now on dxrx99) and x2b wrote the original PlatformEmulator for TestCord.
- Vendicated and contributors wrote Vencord, which TestCord builds on. The self-view icon set matches Vencord's PlatformIndicators.
- DavidHiFi added the self-view toggle and the voice channel indicator.

Missing or wrong credit? Open an issue and it gets fixed.

## Rollback

Turn Show Own Spoofed off, or remove `index.tsx` from the plugin folder. The plugin restores the original sessions store method when it stops, and it writes no settings files of its own.
