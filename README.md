# FakeVoice user plugin

FakeVoice lets you control the fake mute, deafen, camera, stream, and Watch Together states from a button in the Discord user area. Right-click the button for separate controls. The plugin also has Ctrl+J and Ctrl+L shortcuts for fake mute and fake deafen.

This is DavidHiFi's maintained fork of deracul's FakeVoice user plugin. The original author remains credited in the plugin metadata. The copyright holders granted permission to publish this fork under the [MIT license](LICENSE).

## Install in TestCord

1. Use a [TestCord source checkout](https://github.com/TestcordDev/TestCord) with Node.js and its required pnpm version.
2. Copy [`index.tsx`](index.tsx) and [`native.ts`](native.ts) to `<TestCord>/src/userplugins/fakevoice/`.
3. In the TestCord checkout, run `pnpm install` if needed, then `pnpm build`.
4. Follow TestCord's desktop injection instructions if TestCord is not already installed. Restart Discord to load the new build.
5. Open Discord User Settings, find FakeVoice in TestCord's plugin list, and enable it.

## External control (Stream Deck bridge)

`native.ts` runs in the Electron main process. It does not implement the fake
states; it reads the renderer API that `index.tsx` installs as
`window.__fakeVoice`, so toggles behave exactly like the context-menu items.

Loopback HTTP API, bound to `127.0.0.1:47830`:

| Route | Effect |
| --- | --- |
| `GET /fakevoice/ping` | Bridge liveness |
| `GET /fakevoice/state` | `{ "mute": bool, "deafen": bool, "camera": bool, "stream": bool, "game": bool }` (true = fake state on) |
| `GET /fakevoice/toggle/<kind>` | Toggle one state, returns the new state |
| `GET /fakevoice/set/<kind>/<0\|1>` | Set one state explicitly |

`<kind>` is `mute`, `deafen`, `camera`, `stream`, or `game`.

Optional system-wide hotkeys, registered by the main process:

| Hotkey | State |
| --- | --- |
| `Ctrl+Alt+Shift+F9` | Fake mute |
| `Ctrl+Alt+Shift+F10` | Fake deafen |
| `Ctrl+Alt+Shift+F11` | Fake camera |
| `Ctrl+Alt+Shift+F12` | Fake stream |
| `Ctrl+Alt+Shift+F8` | Fake game |

A ready-made Stream Deck plugin that uses this bridge (Fake Mute, Fake Deafen,
Fake Camera, Fake Stream, Fake Game keys with on/off state) is installed at
`%APPDATA%\Elgato\StreamDeck\Plugins\com.davidhifi.fakevoice.sdPlugin`; its key
faces bake in the name and the ON/OFF word so the deck never clips a title.

If Stable and a second TestCord client run at once, only the first one to start
owns port 47830, so the bridge controls that client.

## Changes in this fork

The plugin's runtime actions, settings, and five webpack patches match the installed version. The source license header changed to MIT. One optional camera preview patch has `noWarn: true`: current Discord builds contain its target module but no matching code, so TestCord previously counted that no-effect result as a plugin failure. This flag leaves the patch attempt and its runtime result unchanged. It does not make that optional patch work on current Discord builds.

TestCord calculates the Unstable badge from a rolling history of plugin failures. This source change prevents that one no-effect patch from creating new failures. Older health records can keep the badge visible until the history ages out or is cleared. The badge is a diagnostic result, not a stability setting in this plugin.

## License and credit

MIT. Original plugin by deracul, maintained here by DavidHiFi with permission to relicense. This fork retains the original author's credit.
