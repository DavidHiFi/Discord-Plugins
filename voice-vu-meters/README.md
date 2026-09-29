# VoiceVUMeters

Per-user vertical voice meters in the channel list and on call tiles. Fork of [Kurtzon Audio's VoiceVUMeters](https://github.com/kurtzonaudio/kurtcord-plugins), maintained as DavidHiFi's copy. MIT licensed.

## Channel measurement

Web audio clients expose a stream for each participant. The plugin splits that stream into separate left and right analysers and shows a visible divider. Hard-left samples move the left bar; hard-right samples move the right bar. Mono streams show one bar.

On Discord Desktop, your own meter opens the exact selected input device with echo cancellation, noise suppression and automatic gain control disabled for the meter capture. It measures the input before Discord encoding. Receiving-side measurement is needed to confirm the transmitted channel layout. The capture is silent and closes when you leave the call, stop the plugin, change input devices or disable Show Self.

Discord Desktop exposes one scalar level for each remote participant. Those participants show one bar with a tooltip explaining the limitation. The plugin cannot derive their channel separation from that scalar. It does not duplicate the scalar into two apparent stereo bars or assign a shared audio mix to a participant.

## Settings

| Setting | Effect |
| --- | --- |
| Floor | Bottom of the level scale, from -80 to -20 dB. |
| Show Peak | Peak hold line with a 900 ms hold. |
| Show Self | Capture and meter the selected input on desktop. |

## Installation and validation

Place the folder in `src/userplugins/VoiceVUMeters` and build your client. Activate the rebuilt payload when a client reload is permitted.

The 2026-09-30 correction passed offline PCM and identity regression checks and isolated desktop and Equibop builds. Live activation and Ableton hard-pan verification are pending under the user's offline-only instruction. Remote desktop per-user stereo requires an audio source exposing each participant's samples.
