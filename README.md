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
| [VoiceVUMeters](voice-vu-meters/) | Per-participant left/right meters, with an audited native bridge for desktop remote stereo. | `src/userplugins/VoiceVUMeters` |
| [HasStrip](has-strip/) | Removes costly :has() stylesheet rules, with visual tradeoffs. | `src/testcordplugins/HasStrip` |
| [PanelLayout](panel-layout/) | The maintained TestCord panel layout, including the ping-freshness fix. | `src/testcordplugins/PanelLayout` |

This collection contains custom implementations and forks with local changes. The duplicate FullVCPFP folder was removed on 2026-10-01; RoundedVCPFP retains the avatar fixes and configurable rounding. Forks keep their original authors and license, so preserve both when sharing changes. `plugins.json` lists the source folder, destination and license for each entry.

## Install

Use a TestCord source checkout. Choose the plugins you want and copy the contents of the source folders listed in `plugins.json` into their destination folders. Copy all source files, including CSS and native helpers. For example, copy `fakevoice/index.tsx` and `fakevoice/native.ts` into `src/userplugins/fakevoice/`. The optional Stream Deck companion lives in `fakevoice/streamdeck/`.

For LyricsStatus, copy `better-lyrics-sync/src/lyricsStatus/`. For Custom Stream Quality, copy `custom-stream-quality/src/`. Those two and PanelLayout replace existing TestCord plugin folders, so back up the old source first. RoundedVCPFP is the maintained avatar fork in this collection. Disable the client's bundled FullVCPFP before enabling RoundedVCPFP.

From the client checkout, build with its documented commands. For the current TestCord tree:

```sh
node scripts/generateBDPlugins.mjs
node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs
```

Load the rebuilt client after your voice call ends. This repository does not restart or alter your running Discord installation.

Vencord and Equicord compatibility depends on the plugin's imports and client APIs. StaffTag includes a `vencord/` variant. TestCord-specific imports in LyricsStatus, PanelLayout and other extensions require TestCord or adaptation to another client. Per-plugin READMEs describe additional requirements.

## Current validation

Sources were synchronized from the maintained client checkout on 2026-09-30. MicSpamGuard passes 49 offline behavior checks. VoiceVUMeters passes 33 offline PCM, pan, identity and peak checks plus an actual two-participant native decoder test. StereoGuard passes 9 hold/recovery checks alongside the shared attribution and cleanup checks. Targeted lint and isolated desktop and Equibop builds passed.

Previous combined builds of all three plugins started without matching errors. The latest guard recovery build was installed and loaded through one authorized restart on 2026-09-30. All three audio plugins logged a clean start, and the saved guard settings stayed unchanged. A live blast/recovery scenario has not been exercised for this build. The maintainer confirmed that their own meter separates hard-left and hard-right input. The 2026-10-01 VoiceVUMeters companion bridge measures each remote participant's decoded left/right PCM on its audited desktop voice build. Two independently encoded synthetic participants passed hard-left/right separation through the actual native decoder, and the bridge loaded in Discord. A live friend test was not performed. Without the bridge, Desktop retains the scalar/local-pan fallback. StereoGuard does not mute anyone based on a shared output-device mix.

MicSpamGuard rejects conflicting participant keys, SSRC owners and explicit user identities before any mute or volume write. Self, outgoing and unidentified samples cannot target another participant. Reproduce its checks from this repository with `npm install` and `npm test`. The tests use synthetic samples and a cached Discord volume-conversion fixture, not a running client.

## Plugin origins

[PROVENANCE.md](PROVENANCE.md) records each plugin's origin and the local changes that justify its inclusion.

## History and licenses

The former standalone repositories are archived with links here. Their original commit histories are retained in this repository under `history/<plugin>-2026-09-30` tags. The master repository's existing history is preserved through the rename. Future plugin changes belong here.

Each folder retains its license and upstream attribution. The collection contains both MIT and GPL-3.0-or-later code; there is no single MIT license for the whole collection. See each folder's `LICENSE` and source headers. The Discord theme MochaCord remains a separate theme project.

## Guard recovery update

MicSpamGuard and StereoGuard use local volume holds, fresh safe evidence, separate trigger/release thresholds and a 1.5-second recovery. Missing samples cannot reopen a held user. A renewed blast or stereo violation immediately closes recovery. The published tests include 49 MicSpamGuard checks and 9 StereoGuard hold/recovery checks. `npm test` runs both. See each guard's README for zero-reading and native stereo limits.
