# StereoGuard

A maintained fork of [Kurtzon Audio's StereoGuard](https://github.com/kurtzonaudio/kurtcord-plugins). It measures pan imbalance, stereo width and changing pan on a known participant's two-channel audio stream.

Only a stream still associated with that participant can trigger a local mute. Both channels are sampled from the same audio frame. Mono, stale streams and unknown channel counts cannot trigger detection. Ignore and restoration controls remain available.

Discord Desktop does not expose remote per-participant PCM through its public voice wrapper. A shared output-device capture can contain several sources, so it is informational only and never assigns a mute to a guessed user. Automatic protection requires a client that exposes participant streams, such as the browser audio path.

Copy this folder to `src/userplugins/StereoGuard` and build your client. The 2026-09-30 attribution correction passed 21 shared offline regression checks, targeted lint and isolated desktop/Equibop builds. Live activation and Ableton hard-pan verification are pending.

MIT. Original plugin by Kurtzon Audio; maintained by DavidHiFi. See LICENSE.
