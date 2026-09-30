# Plugin origins

This collection includes custom plugins and changed forks. It does not claim authorship of their upstream code. The audit on 2026-10-01 compared bundled TestCord plugins against `TestcordDev/TestCord`'s `dev` branch and the audio forks against `kurtzonaudio/kurtcord-plugins`. Local development records identify the changes below.

| Plugin | Origin and maintained changes |
| --- | --- |
| StaffTag | Adaptation of the BetterDiscord StaffTag behavior for TestCord, Equicord and Vencord. Adds client-native staff badges and fixes voice and message badge startup. |
| FakeVoice | Fork of deracul's FakeVoice. Adds a loopback bridge, hotkeys and a Stream Deck companion. The maintainer recorded permission to use MIT. |
| LyricsStatus | GPL fork of TestCord LyricsStatus. Adds Dopamine playback support, timing changes and a Dopamine RPC companion. |
| Custom Stream Quality | Independent MIT rewrite. Separates encoder settings from advertised voice-gateway stream metadata and keeps existing setting keys. |
| RoundedVCPFP | GPL fork of Equicord FullVCPFP. Adds configurable tile rounding, an avatar mask and avatar URL fallbacks. |
| MicSpamGuard | MIT fork of Kurtzon Audio's MicSpamGuard. Adds desktop inbound-stat support, participant identity checks, voice balancing, volume holds and gradual recovery. |
| StereoGuard | MIT fork of Kurtzon Audio's StereoGuard. Adds stream ownership checks, matching stereo frames and coordinated volume holds. Shared desktop output capture never mutes a guessed participant. |
| VoiceVUMeters | MIT fork of Kurtzon Audio's VoiceVUMeters. Adds channel meters and desktop remote bars that follow local pan. The published version's limitations remain documented in its README. |
| HasStrip | Custom plugin that removes stylesheet rules containing `:has()` to address measured style recalculation stalls. Its visual tradeoffs are documented. |
| PanelLayout | GPL fork of TestCord PanelLayout. Includes changes to the system monitor and music controls, including the voice ping freshness fix. Most upstream modules remain unchanged. |

FullVCPFP was removed because its local fixes are already present in RoundedVCPFP. Earlier cleanup removed the unchanged Zak's Fake Mute/Deafen and NoMirroredCamera copies. Git history retains those removals for rollback.

Keep each folder's copyright notices and license when redistributing it. A changed fork remains a fork; improvements do not transfer ownership of the original code.
