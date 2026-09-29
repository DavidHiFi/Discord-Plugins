# MicSpamGuard

A Vencord / Equicord user plugin that locally mutes anyone who gets too loud or spams their mic
in a Discord voice channel.

Fork of [Kurtzon Audio's MicSpamGuard](https://github.com/kurtzonaudio/kurtcord-plugins) rebuilt
to actually work on Discord Desktop: the original depends on per-user WebAudio streams that only
exist in web clients, this version reads the media engine's own voice stats instead.

## Features

- Watches every incoming voice stream and silences whoever crosses your loudness threshold.
- **Hold, don't bounce**: muting takes the user's local volume to 0 and keeps watching; their
  real volume comes back only after they have been quiet for the configured time. No
  mute/unmute loops while they keep blasting.
- Snap settings: threshold 30-100% in steps of 5, sensitivity 1-10, auto-unmute
  Off / 3 s / 5 s / 10 s / 30 s / 1 min / 2 min / 5 min.
- Toasts for mute, unmute and auto-unmute.
- Friends are never muted by default; per-user ignore list; live level panel; Unmute all.
- User area button: left-click opens the guard, right-click toggles it; it also shows up in
  PanelLayout's button list.
- Crash safe: held volumes are persisted and restored on the next start.

## Install

Copy this folder into `src/userplugins/MicSpamGuard` of your Vencord / Equicord client tree,
then rebuild and fully restart the client:

    node scripts/generateBDPlugins.mjs
    node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs

(Skip `generateBDPlugins` if your fork does not have it; a plain `pnpm build` works too.)

## Settings

| Setting | What it does |
| --- | --- |
| Enabled | Master switch. Turning it off releases any holds. |
| Threshold | Loudness percentage that counts as too loud, on the same scale as the live level meter. |
| Sensitivity | How many loud samples are needed before a mute (higher = faster trigger). |
| Auto Unmute | Quiet time before a hold lifts, so a loud user stays silent until they actually stop. |
| Ignore Friends | Never mute friends. |
| Notify | Show toasts for mute, unmute and auto-unmute. |

## Authors

DavidHiFi

## License

MIT
