# MicSpamGuard

A Vencord and Equicord user plugin that balances each person's voice volume and temporarily mutes sustained extreme loudness in Discord. Both controls can run together.

Fork of [Kurtzon Audio's MicSpamGuard](https://github.com/kurtzonaudio/kurtcord-plugins). This version reads Discord Desktop's incoming voice statistics.

## Voice balancing

Enable Dynamic User Volume to reduce loud voices and gradually boost quiet speech. Each person has a separate controller. Their manual local volume is the baseline, and manual changes become the new baseline. The default 2:1 compression and level target of 65 apply moderate correction. Brief pauses hold the adjustment. Sustained silence restores the manual volume smoothly. Silence and low background noise do not trigger a boost.

Automatic boosts stop at 200% on Discord's slider. Higher manual volumes remain intact. The plugin uses Discord's nonlinear volume conversion functions, including when VolumeBooster unlocks a higher slider range.

## Settings

| Setting | Behavior |
| --- | --- |
| Enabled | Master switch. Disabling restores held volumes and mutes. |
| Extreme loudness protection | Independently enable sustained-extreme muting. |
| Extreme loudness threshold | Range 90 to 100. Default 98. Everyday loud speech is handled by balancing. |
| Mute sensitivity | Higher reacts sooner. Normal or quiet samples reset the consecutive-extreme count. |
| Auto unmute | Time extreme loudness must stop before restoration. Off requires manual unmute. |
| Dynamic User Volume | Independently enable smooth voice balancing. |
| Voice level | Target 55 to 75. Default 65. Higher preserves more loudness. |
| Maximum volume reduction | Cap of 3 to 18 dB below the manual baseline. Default 12 dB. |
| Maximum quiet voice boost | Cap of 0 to 12 dB above baseline. Default 6 dB. Zero disables boosting. |
| Response speed | Fast, Balanced or Gentle. Default Balanced. |
| Ignore Friends | Exclude friends from both protections. |
| Notify | Toasts for mute, unmute and manual restore. Balancing stays silent. |

Self, bots, ignored users, locally muted users and users manually set to zero are excluded. Restore pauses balancing for that person until Resume. Leaving the call, disabling the feature or stopping the plugin restores held baselines. The plugin persists held raw volumes for recovery after a restart.

Existing aggressive settings above 18 dB reduction migrate once to a level target of 65, a 12 dB reduction cap and a 6 dB boost cap. Legacy thresholds below 90 migrate to 98. Other saved choices remain intact.

Periodic incoming voice statistics limit reaction time. Brief bursts can arrive before correction, and background noise above the speech gate can count as speech. Response speed controls smoothing after a sample arrives.

The user-area button opens settings on left click and toggles the guard on right click.

## Install

Copy this folder into `src/userplugins/MicSpamGuard` in your client tree and rebuild:

```sh
node scripts/generateBDPlugins.mjs
node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs
```

Skip `generateBDPlugins` if your fork does not have it. Restart the client after leaving your voice call to load the new bundle.

## License

MIT. DavidHiFi.
