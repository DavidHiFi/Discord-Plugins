<div align="center">

<img src="https://socialify.git.ci/DavidHiFi/Discord-Plugins/image?description=1&font=Inter&language=1&name=1&owner=1&pattern=Plus&theme=Dark" alt="Discord-Plugins by DavidHiFi: Discord client plugins and companion tools for TestCord" width="100%">

# Discord plugins

**My Discord client plugins, forks and companion tools for TestCord, in one source repository.**

Voice guards and meters, stream controls, staff badges, lyrics in your status and a few fixes.

<a href="https://github.com/DavidHiFi/Discord-Plugins/releases/latest">
<img src="https://img.shields.io/badge/%E2%AC%87%EF%B8%8F%20DOWNLOAD%20LATEST%20RELEASE-2EA043?style=for-the-badge&labelColor=161B22" alt="Download the latest release" height="42">
</a>

<br><br>

<img src="https://img.shields.io/github/v/release/DavidHiFi/Discord-Plugins?style=flat-square&label=version&color=8957E5&labelColor=161B22" alt="Latest version">
<img src="https://img.shields.io/github/downloads/DavidHiFi/Discord-Plugins/total?style=flat-square&label=downloads&color=1F6FEB&labelColor=161B22" alt="Total downloads">
<img src="https://img.shields.io/badge/platform-Discord%20%28TestCord%29-DB6D28?style=flat-square&labelColor=161B22" alt="Platform: Discord with TestCord">

</div>

---

## Installation

These are source plugins. You build them into the client yourself.

1. Set up a [TestCord](https://github.com/TestcordDev/TestCord) source checkout with Node.js and pnpm, as its own docs describe.
2. Download the ZIP from the [latest release](https://github.com/DavidHiFi/Discord-Plugins/releases/latest) and unzip it. `SHA256SUMS.txt` lets you check the download.
3. For each plugin you want, copy its source folder into the destination folder in the checkout. The table under [Plugin folders](#plugin-folders) lists both. Copy every file, CSS and native helpers included.
4. From the checkout, run `pnpm install` once, then `pnpm build`.
5. Restart Discord after your voice call ends, then turn the plugins on under **Settings**, **TestCord**, **Plugins**.

LyricsStatus, Custom Stream Quality, PanelLayout and StreamEnhancer replace plugins that TestCord already ships, so back up those folders first. Turn off the bundled FullVCPFP before you turn on RoundedVcPfp.

## Features

### Voice

- **MicSpamGuard:** balances voice levels and holds anyone who stays extremely loud at local volume zero, then fades them back in.
- **StereoGuard:** locally silences a participant whose audio is not mono, and restores them once it is.
- **VoiceVUMeters:** left and right level meters for everyone in the call, in the channel list and on call tiles.
- **ClickToUnmute:** click a locally muted member's mute icon to unmute them.
- **RoundedVcPfp:** full-size avatars on call tiles, with rounding, zoom, glow and speaking-ring options.
- **FakeVoice:** fake mute, deafen, camera, stream and game states, with optional hotkeys and Stream Deck buttons.

### Streaming

- **StreamEnhancer:** TestCord's stream tuning plugin with a working local camera preview and an optional spoofed resolution and FPS badge.
- **Custom Stream Quality:** encoder and badge controls. It is legacy now; StreamEnhancer replaces it.

### Interface

- **StaffTag:** a crown or text badge next to server owners, admins and moderators in voice, the member list, messages and profiles.
- **PanelLayout:** TestCord's panel layout, with a footer ping that shows real voice latency during calls.
- **HasStrip:** removes `:has()` style rules that make Discord stutter, at the cost of some visual details.

### Status

- **LyricsStatus:** shows the current lyric line from Dopamine, TIDAL or Spotify as your custom status.

## Notes

> [!IMPORTANT]
> **Built for TestCord.** StaffTag also ships a Vencord version and runs on Equicord, and RoundedVcPfp has a `vencord/` folder. The other plugins use TestCord imports and need changes to run elsewhere.

> [!NOTE]
> **Desktop stereo needs the native bridge.** VoiceVUMeters and StereoGuard read each person's left and right audio on Discord Desktop through the bridge in `voice-vu-meters/native`. Its installer checks Discord's voice module against a pinned hash and refuses anything else. Without the bridge, the meters fall back to one level and StereoGuard does nothing.

> [!NOTE]
> **Each folder keeps its own license.** Forks keep their original authors and license. The collection mixes MIT and GPL-3.0-or-later code, so read the `LICENSE` in a plugin's folder before you reuse it.

<details>
<summary><b>Plugin folders</b></summary>

<br>

`plugins.json` holds the same list in machine-readable form. [PROVENANCE.md](PROVENANCE.md) records where each plugin came from and what I changed.

| Plugin | Copy this | Into this TestCord folder | License |
|---|---|---|---|
| [MicSpamGuard](mic-spam-guard/) | `mic-spam-guard/` | `src/userplugins/MicSpamGuard` | MIT |
| [StereoGuard](stereo-guard/) | `stereo-guard/` | `src/userplugins/StereoGuard` | MIT |
| [VoiceVUMeters](voice-vu-meters/) | `voice-vu-meters/` | `src/userplugins/VoiceVUMeters` | MIT |
| [ClickToUnmute](click-to-unmute/) | `click-to-unmute/` | `src/userplugins/ClickToUnmute` | MIT |
| [RoundedVcPfp](rounded-vc-pfp/) | `rounded-vc-pfp/` | `src/userplugins/RoundedVcPfp` | GPL-3.0-or-later |
| [FakeVoice](fakevoice/) | `fakevoice/` | `src/userplugins/fakevoice` | MIT |
| [StreamEnhancer](stream-enhancer/) | `stream-enhancer/` | `src/testcordplugins/StreamEnhancer` | GPL-3.0-or-later |
| [Custom Stream Quality](custom-stream-quality/) | `custom-stream-quality/src/` | `src/testcordplugins/StreamQuality` | MIT |
| [StaffTag](stafftag/) | `stafftag/` | `src/userplugins/staffTag` | MIT |
| [PanelLayout](panel-layout/) | `panel-layout/` | `src/testcordplugins/PanelLayout` | GPL-3.0-or-later |
| [HasStrip](has-strip/) | `has-strip/` | `src/testcordplugins/HasStrip` | GPL-3.0-or-later |
| [LyricsStatus](better-lyrics-sync/) | `better-lyrics-sync/src/lyricsStatus/` | `src/testcordplugins/lyricsStatus` | GPL-3.0-or-later |
| [PlatformEmulator](platform-emulator/) | `platform-emulator/` | `src/testcordplugins/PlatformEmulator` | GPL-3.0-or-later |

The FakeVoice Stream Deck plugin is in `fakevoice/streamdeck/`, and the Dopamine companion for LyricsStatus is in `better-lyrics-sync/dopamine-rpc-patch/`. Each plugin folder has a README with its own setup steps and limits.

</details>

<details>
<summary><b>Running the tests</b></summary>

<br>

The tests use synthetic audio samples and captured Discord code, so no running client is needed.

```sh
npm install
npm test
```

They cover MicSpamGuard (62 checks), StereoGuard (22), the PanelLayout ping (11) and StreamEnhancer's badge, camera and patch checks. They do not prove behaviour in a live call.

</details>

<details>
<summary><b>History</b></summary>

<br>

The plugins used to live in separate repositories. Those are archived and link here, and their commit histories are kept in this repo under `history/<plugin>-2026-09-30` tags. New plugin changes go here.

</details>

---

## Support development

These plugins are free and always will be. If one of them makes your calls better, a coffee keeps them going.

[![Support DavidHiFi on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/davidhifi)

## Contributing

Bug reports with the plugin name and your TestCord version help the most, and fixes are welcome.

<a href="CONTRIBUTING.md">
<img src="https://img.shields.io/badge/%F0%9F%A4%9D%20HOW%20TO%20CONTRIBUTE-8957E5?style=for-the-badge&labelColor=161B22" alt="How to contribute" height="36">
</a>

## Star history

Thanks for the stars, plugin reports and fixes.

<a href="https://www.star-history.com/?repos=DavidHiFi%2FDiscord-Plugins&amp;type=date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DavidHiFi/Discord-Plugins&amp;type=date&amp;theme=dark&amp;legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DavidHiFi/Discord-Plugins&amp;type=date" />
    <img alt="DavidHiFi/Discord-Plugins GitHub star history" src="https://api.star-history.com/chart?repos=DavidHiFi/Discord-Plugins&amp;type=date" />
  </picture>
</a>

## Credits

- **Author:** Myself, [DavidHiFi](https://github.com/DavidHiFi)

| Who | What |
|---|---|
| **Kurtzon Audio** ([Kurtzon's Discord plugins](https://github.com/kurtzonaudio/kurtzons-discord-plugins), MIT) | The original MicSpamGuard, StereoGuard, VoiceVUMeters and ClickToUnmute, which these forks build on. |
| **deracul** ([TestCord](https://github.com/TestcordDev/TestCord)) | The original FakeVoice plugin. This fork is MIT with the copyright holders' permission. |
| **mochienya** ([Equicord FullVCPFP](https://github.com/Equicord/Equicord/tree/main/src/equicordplugins/fullVcPfp), GPL-3.0) | FullVCPFP, the plugin RoundedVcPfp is forked from. |
| **omaw** ([TestCord StreamEnhancer](https://github.com/TestcordDev/TestCord/tree/main/src/testcordplugins/StreamEnhancer), GPL-3.0) | The upstream StreamEnhancer plugin. |
| **Sharp** ([TestCord LyricsStatus](https://github.com/TestcordDev/TestCord/tree/main/src/testcordplugins/lyricsStatus), GPL-3.0) | The upstream LyricsStatus plugin. |
| **deracul, Aviv, x2b and sirphantom89** ([TestCord PanelLayout](https://github.com/TestcordDev/TestCord/tree/main/src/testcordplugins/PanelLayout), GPL-3.0) | The upstream PanelLayout plugin and most of its modules. |
| **x2b** ([TestCord](https://github.com/TestcordDev/TestCord)) | The original Custom Stream Quality plugin, which my version rewrites. |
| **DevilBro** ([BetterDiscord StaffTag](https://github.com/mwittrien/BetterDiscordAddons/tree/20e22dfbf7f55d84b22a703a594242275c525399/Plugins/StaffTag)) | The idea behind StaffTag. No BetterDiscord code is used. |
| **Tsuda Kageyu** ([MinHook](https://github.com/TsudaKageyu/minhook), BSD-2-Clause) | The hooking library bundled with the VoiceVUMeters native bridge. |
| **Vendicated and contributors** ([Vencord](https://github.com/Vendicated/Vencord), GPL-3.0) | The plugin API that TestCord and Equicord inherit, and the copyright line on the GPL plugins. |

Built on [Discord](https://discord.com), [TestCord](https://github.com/TestcordDev/TestCord), [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), with [TypeScript](https://www.typescriptlang.org), [Node.js](https://nodejs.org), [esbuild](https://esbuild.github.io), [CMake](https://cmake.org), [MinHook](https://github.com/TsudaKageyu/minhook), [LRCLIB](https://lrclib.net), [Dopamine](https://github.com/digimezzo/dopamine) and the [Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/).

> Missing or wrong credit? [Open an issue](https://github.com/DavidHiFi/Discord-Plugins/issues/new) and I'll fix it.

## Disclaimers

Most of this project's code was developed with AI coding agents, including Claude Code, Codex and OpenCode. No single AI agent made the project.

Client mods such as TestCord, Equicord and Vencord are against Discord's Terms of Service, and these plugins only run inside one. Use them at your own risk. FakeVoice and the stream badge options change what other people see, and the VoiceVUMeters bridge hooks Discord's voice module.

The guards change other people's volume only on your own client. Nobody else in the call hears a difference.

<div align="center">
<br>
<sub>Not affiliated with Discord, TestCord, Equicord, Vencord or Elgato. Requires the Discord desktop app and a <a href="https://github.com/TestcordDev/TestCord">TestCord</a> source checkout.</sub>
</div>
