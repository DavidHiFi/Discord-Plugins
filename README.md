# David's Vencord Plugins

Master repository for my user plugins for [Vencord](https://github.com/Vencord/Vencord), [Equicord](https://github.com/Equicord/Equicord), and [TestCord](https://github.com/TestcordDev/Testcord). Each plugin lives in its own repository and is pinned here as a git submodule — one place to find everything, without merging the histories.

| Plugin | What it does | Standalone repo |
| --- | --- | --- |
| [StaffTag](stafftag/) | Crown beside the names of Discord staff members in chat, member lists, and profiles | [StaffTag-UserPlugin](https://github.com/DavidHiFi/StaffTag-UserPlugin) |
| [FakeVoice](fakevoice/) | Maintained TestCord fork of FakeVoice: fake voice stats, device spoofing, and health-tracking fixes | [FakeVoice-UserPlugin](https://github.com/DavidHiFi/FakeVoice-UserPlugin) |
| [Better Lyrics Sync](better-lyrics-sync/) | Current lyric line as your custom status from Dopamine, TIDAL, or Spotify — plus a Dopamine cover-art RPC patch | [better-lyrics-sync](https://github.com/DavidHiFi/better-lyrics-sync) |
| [Custom Stream Quality](custom-stream-quality/) | MIT rewrite of the stream-quality plugin with independent advertised badge settings | [CustomStreamQuality-UserPlugin](https://github.com/DavidHiFi/CustomStreamQuality-UserPlugin) |

## Cloning

```bash
git clone --recurse-submodules https://github.com/DavidHiFi/Davids-Vencord-Plugins.git
```

Already cloned without submodules?

```bash
git submodule update --init --recursive
```

Update every plugin to its latest main commit:

```bash
git submodule update --remote
```

## Installing a plugin

Each plugin ships its own README with per-plugin install steps. The usual TestCord/Vencord shape is: copy the plugin folder into your client-mod source checkout, run its build, then fully restart Discord (`Ctrl+R` is not enough — the main process caches the renderer bundle).

| Plugin | Install entry point |
| --- | --- |
| StaffTag | [`stafftag/`](stafftag/) — copy `src/userplugins/staffTag`, rebuild, restart |
| FakeVoice | [`fakevoice/`](fakevoice/) — copy `src/userplugins/fakevoice`, rebuild, restart |
| Better Lyrics Sync | [`better-lyrics-sync/`](better-lyrics-sync/) — copy `src/lyricsStatus`, rebuild, restart; Dopamine users also run `dopamine-rpc-patch` |
| Custom Stream Quality | [`custom-stream-quality/`](custom-stream-quality/) — copy the plugin folder, rebuild, restart |

## Licenses

- StaffTag: MIT
- Custom Stream Quality: MIT
- Better Lyrics Sync: GPL-3.0-or-later (inherits the upstream TestCord plugin)
- FakeVoice: GPL-3.0-or-later (inherits the upstream TestCord plugin)

Each submodule keeps its own license; see the linked repositories for full terms.
