# Discord plugins

DavidHiFi's maintained Discord client plugins, forks and companion tools in one repository. This is the current home for the collection. All plugin sources are included directly. A normal clone or GitHub ZIP contains everything listed below.

## Get the collection

```sh
git clone https://github.com/DavidHiFi/Discord-Plugins.git
```

Or use [Download ZIP](https://github.com/DavidHiFi/Discord-Plugins/archive/refs/heads/main.zip). No submodule commands or separate plugin repositories are required.

## Plugins

| Plugin | What it does | TestCord destination |
| --- | --- | --- |
| [StaffTag](stafftag/) | Staff badges in chat, member lists and profiles. | `src/userplugins/staffTag` |
| [FakeVoice](fakevoice/) | Local fake voice states, a native loopback bridge and Stream Deck controls. | `src/userplugins/fakevoice` |
| [LyricsStatus](better-lyrics-sync/) | Current lyric lines in custom status, with the Dopamine RPC companion. | `src/testcordplugins/lyricsStatus` |
| [Custom Stream Quality](custom-stream-quality/) | Encoder controls and independent advertised stream badges. | `src/testcordplugins/StreamQuality` |
| [RoundedVcPfp](rounded-vc-pfp/) | Rounded full-resolution avatars on call tiles. | `src/userplugins/RoundedVcPfp` |
| [MicSpamGuard](mic-spam-guard/) | Gentle voice balancing and sustained extreme-loudness protection. | `src/userplugins/MicSpamGuard` |
| [StereoGuard](stereo-guard/) | Stereo detection for known per-participant streams; no guessed output-mix mutes. | `src/userplugins/StereoGuard` |
| [VoiceVUMeters](voice-vu-meters/) | Real channel meters where streams are available; desktop remote bars follow your local pan. | `src/userplugins/VoiceVUMeters` |
| [HasStrip](has-strip/) | Removes costly :has() stylesheet rules, with visual tradeoffs. | `src/testcordplugins/HasStrip` |
| [PanelLayout](panel-layout/) | The maintained TestCord panel layout, including the ping-freshness fix. | `src/testcordplugins/PanelLayout` |
| [FullVCPFP](full-vc-pfp/) | Maintained full-avatar call tiles and membership fixes. | `src/equicordplugins/fullVcPfp` |

Every plugin here was written or changed by DavidHiFi. Forks keep their original authors and license, so preserve both when sharing changes. `plugins.json` lists the source folder, destination and license for each entry.

## Install

Use a TestCord source checkout. Choose the plugins you want and copy the contents of the source folders listed in `plugins.json` into their destination folders. Copy all source files, including CSS and native helpers. For example, copy `fakevoice/index.tsx` and `fakevoice/native.ts` into `src/userplugins/fakevoice/`. The optional Stream Deck companion lives in `fakevoice/streamdeck/`.

For LyricsStatus, copy `better-lyrics-sync/src/lyricsStatus/`. For Custom Stream Quality, copy `custom-stream-quality/src/`. Those two and PanelLayout replace existing TestCord plugin folders, so back up the old source first. FullVCPFP replaces the Equicord plugin bundled with TestCord. Do not enable FullVCPFP and RoundedVcPfp together.

From the client checkout, build with its documented commands. For the current TestCord tree:

```sh
node scripts/generateBDPlugins.mjs
node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs
```

Load the rebuilt client after your voice call ends. This repository does not restart or alter your running Discord installation.

Vencord and Equicord compatibility depends on the plugin's imports and client APIs. StaffTag includes a `vencord/` variant. TestCord-specific imports in LyricsStatus, PanelLayout and other extensions require TestCord or adaptation to another client. Per-plugin READMEs describe additional requirements.

## Current validation

Sources were synchronized from the maintained client checkout on 2026-09-30. MicSpamGuard passes 40 offline behavior checks. VoiceVUMeters passes 22 offline PCM, pan and identity checks. StereoGuard passes its offline attribution and cleanup checks. Targeted lint and isolated desktop and Equibop builds passed.

This build of all three plugins has been running in the maintainer's Discord since 2026-09-30, and each started without errors. The maintainer confirmed that their own meter separates hard-left and hard-right input. Discord Desktop gives one level per remote participant. VoiceVUMeters shows that level in two bars, following your local pan for that person. It cannot measure a remote participant's own stereo. StereoGuard does not mute anyone based on a shared output-device mix.

MicSpamGuard rejects conflicting participant keys, SSRC owners and explicit user identities before any mute or volume write. Self, outgoing and unidentified samples cannot target another participant. Reproduce its checks from this repository with `npm install` and `npm test`. The tests use synthetic samples and a cached Discord volume-conversion fixture, not a running client.

## History and licenses

The former standalone repositories are archived with links here. Their original commit histories are retained in this repository under `history/<plugin>-2026-09-30` tags. The master repository's existing history is preserved through the rename. Future plugin changes belong here.

Each folder retains its license and upstream attribution. The collection contains both MIT and GPL-3.0-or-later code; there is no single MIT license for the whole collection. See each folder's `LICENSE` and source headers. The Discord theme MochaCord remains a separate theme project.
