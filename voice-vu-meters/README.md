# VoiceVUMeters

Per-user vertical voice meters in the channel list and on call tiles. Fork of [Kurtzon Audio's VoiceVUMeters](https://github.com/kurtzonaudio/kurtcord-plugins), maintained as DavidHiFi's copy. MIT licensed.

## Channel measurement

Web audio clients expose a stream for each participant. The plugin splits that stream into separate left and right analysers and shows a visible divider. Hard-left samples move the left bar; hard-right samples move the right bar. Mono streams show one bar.

On Discord Desktop, your own meter opens the exact selected input device with echo cancellation, noise suppression and automatic gain control disabled for the meter capture. It measures the input before Discord encoding. Receiving-side measurement is needed to confirm the transmitted channel layout. The capture is silent and closes when you leave the call, stop the plugin, change input devices or disable Show Self.

Discord Desktop exposes one scalar level for each remote participant. Their two bars carry that level through your local pan for that user, so a user you pan hard left drops out of the right bar. Their tooltip says so. The plugin cannot measure a remote participant's own channel separation on desktop and does not assign a shared audio mix to anyone.

## Settings

| Setting | Effect |
| --- | --- |
| Floor | Bottom of the level scale, from -80 to -20 dB. |
| Show Peak | Peak hold line with a 900 ms hold. |
| Show Self | Capture and meter the selected input on desktop. |

## Installation and validation

Place the folder in `src/userplugins/VoiceVUMeters` and build your client. Activate the rebuilt payload when a client reload is permitted.

The 2026-09-30 build passes 22 offline PCM, pan and identity regression checks plus isolated desktop and Equibop builds. The user confirmed live that their own meter separates Ableton hard-left and hard-right input. Remote desktop per-user stereo would need an audio source exposing each participant's samples.
