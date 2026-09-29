# MicSpamGuard

A Vencord / Equicord user plugin that locally mutes, or dynamically turns down, anyone who
gets too loud or spams their mic in a Discord voice channel.

Fork of [Kurtzon Audio's MicSpamGuard](https://github.com/kurtzonaudio/kurtcord-plugins) rebuilt
to actually work on Discord Desktop: the original depends on per-user WebAudio streams that only
exist in web clients, this version reads the media engine's own voice stats instead.

## Features

- Watches every incoming voice stream and reacts to whoever crosses your loudness threshold.
- **Hold, don't bounce**: muting takes the user's local volume to 0 and keeps watching; their
  real volume comes back only after they have been quiet for the configured time. No
  mute/unmute loops while they keep blasting.
- **Dynamic User Volume**: an alternative to muting. The guard lowers the person's local volume
  while they are loud and eases it back when they quiet down, so you can still hear them. The
  volume follows their loudness on every stats sample, like a simple compressor, and never
  drops below the floor you configure.
- The live levels panel lists exactly who is in the voice channel right now. Anyone who leaves
  disappears from it.
- Snap settings: threshold 30-100% in steps of 5, sensitivity 1-10, auto-unmute
  Off / 3 s / 5 s / 10 s / 30 s / 1 min / 2 min / 5 min, turn-down floor 0-60% in steps of 5.
- Toasts for mute, unmute, auto-unmute, turn-down and restore.
- Friends are never muted or turned down by default; per-user ignore list; live level panel;
  Unmute all and Restore all.
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
| Enabled | Master switch. Turning it off releases any holds and restores any turned-down volume. |
| Threshold | Loudness percentage that counts as too loud, on the same scale as the live level meter. Dynamic User Volume keeps loud users under this line. |
| Sensitivity | How many loud samples are needed before a mute (mute mode only). |
| Auto Unmute | Quiet time before a hold lifts, so a loud user stays silent until they actually stop (mute mode only). |
| Dynamic User Volume | Turn people down instead of muting them. Their volume comes back when they quiet down. |
| Dynamic User Volume Floor | The quietest the guard will turn someone down to while they are loud. |
| Ignore Friends | Never mute or turn down friends. |
| Notify | Show toasts for mute, unmute, auto-unmute, turn-down and restore. |

## Authors

DavidHiFi

## License

MIT
