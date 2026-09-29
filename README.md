# StereoGuard

A Vencord / Equicord user plugin that locally mutes anyone whose audio is obnoxiously in
stereo: hard panned, panning around, or wide stereo music.

Fork of [Kurtzon Audio's StereoGuard](https://github.com/kurtzonaudio/kurtcord-plugins) rebuilt
to work on Discord Desktop as well as web clients.

## How it works

- Web clients: per-user left/right streams are scored directly (pan imbalance, stereo width and
  pan swing over a rolling window).
- Discord Desktop: the native engine never exposes per-user L/R, so the plugin listens to
  **Discord's own output device** instead. By default it auto-matches the input side of the
  current output device (for example `Discord Output (VAIO 2)` -> `Discord Input (VAIO 2)`),
  and assigns the output mix's stereo score to the only audible remote user. With several people
  talking at once it holds back rather than risk silencing the wrong person. The capture device
  can be pinned by name in the settings.

## Features

- Same hold behaviour as MicSpamGuard: a held user is silenced via local volume 0, monitoring
  continues, and their volume returns only after the chosen quiet time. No mute/unmute loops.
- Snap settings: threshold 30-100% in steps of 5, sensitivity 1-10, auto-unmute
  Off / 3 s / 5 s / 10 s / 30 s / 1 min / 2 min / 5 min.
- Toasts for mute, unmute and auto-unmute.
- Friends are never muted by default; per-user ignore list; live stereo score panel with an
  output-mix row; Unmute all.
- User area button ("Stereo Guard"): left-click opens the guard, right-click toggles it; it also
  shows up in PanelLayout's button list.
- Crash safe: held volumes are persisted and restored on the next start.

## Install

Copy this folder into `src/userplugins/StereoGuard` of your Vencord / Equicord client tree,
then rebuild and fully restart the client:

    node scripts/generateBDPlugins.mjs
    node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs

(Skip `generateBDPlugins` if your fork does not have it; a plain `pnpm build` works too.)

## Settings

| Setting | What it does |
| --- | --- |
| Enabled | Master switch. Turning it off releases any holds. |
| Desktop Capture | Desktop only: listen to Discord's own output to detect stereo. |
| Capture Device | Optional capture device name for desktop detection; empty auto-matches the current output device. |
| Threshold | Stereo score that counts as obnoxious, on the same scale as the live panel. |
| Sensitivity | How many stereo samples are needed before a mute (higher = faster trigger). |
| Auto Unmute | Quiet time before a hold lifts, so a stereo user stays silent until they actually stop. |
| Ignore Friends | Never mute friends. |
| Notify | Show toasts for mute, unmute and auto-unmute. |

## Authors

DavidHiFi

## License

MIT
