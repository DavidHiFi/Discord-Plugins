# VoiceVUMeters

Per-user vertical voice meters in the channel list and on call tiles. Fork of [Kurtzon Audio's VoiceVUMeters](https://github.com/kurtzonaudio/kurtcord-plugins), maintained as DavidHiFi's copy. MIT licensed.

## Channel measurement

Web audio clients expose a stream for each participant. The plugin splits that stream into separate left and right analysers and shows two bars with a visible divider. Hard-left samples move the left bar; hard-right samples move the right bar. A confirmed mono stream feeds both bars.

On Discord Desktop, your own meter opens the exact selected input device with echo cancellation, noise suppression and automatic gain control disabled for the meter capture. It measures the input before Discord encoding. Receiving-side measurement is needed to confirm the transmitted channel layout. The capture is silent and closes when you leave the call, stop the plugin, change input devices or disable Show Self.

Discord Desktop exposes one scalar level for each remote participant. Their two bars carry that level through your local pan for that user. A user you pan hard left drops out of the right bar. Their tooltip explains the source. A remote user's own hard pan cannot be measured from that scalar. Desktop remote per-user stereo remains incomplete.

Process loopback records Discord's combined output. It cannot separate simultaneous participants or assign channel differences to a person. The experimental loopback helper is not part of this plugin. StereoGuard must only attribute stereo from a stream owned by a known participant.

## Settings

| Setting | Effect |
| --- | --- |
| Floor | Bottom of the level scale, from -80 to -20 dB. |
| Show Peak | Holds each channel's peak marker for 1.5 seconds, then falls at 12 dB per second. The marker remains visible at full scale. |
| Show Self | Capture and meter the selected input on desktop. |

This update enables Show Peak once. Later changes to the setting are respected. Meter release depends on elapsed time, so changes in callback frequency do not change its fall rate.

## Installation and validation

Place the folder in `src/userplugins/VoiceVUMeters` and build your client. Restart the client to load a rebuilt desktop renderer when its main process caches the renderer text.

The 2026-09-30 peak-marker update passes 29 offline regression checks, targeted ESLint, and isolated full desktop and Equibop builds. The checks cover hard-left/right PCM, dual mono, silence, stale frames, participant identity conflicts, shared-mix attribution, selected input capture and cleanup, the divider, independent channel peaks, peak hold timing and callback frequency. Synthetic PCM checks do not prove live transmitted audio behavior.

The user previously confirmed live that their own meter separates Ableton hard-left and hard-right input. The updated desktop renderer was installed with matching hashes and loaded after one authorized restart. Startup logs show all three audio plugins starting without matching warnings or errors. Show Peak and its migration flag are saved as enabled. This run did not verify remote participant stereo or observe the peak marker on screen.

## Rollback

For the local installation, the pre-update renderer files are in `backups/2026-09-30/voice-stereo-peak`. Restore those files to the desktop dist directory and restart the client through the coordinated activation lane. Installation and startup receipts are in `reports/2026-09-30-voice-stereo`.

No DevTools, foreground shortcuts, focus automation or clipboard injection were used. Ableton, VB-Audio Matrix and Stream Deck retained their process IDs through the Discord restart.
