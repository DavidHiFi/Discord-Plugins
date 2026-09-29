# RoundedVcPfp User Plugin

RoundedVcPfp fills a voice channel tile with each participant's full profile picture and rounds the corners instead of leaving hard right angles. It is a fork of Equicord's FullVCPFP with a configurable corner radius.

This is a source plugin for [TestCord](https://github.com/TestcordDev/TestCord), [Equicord](https://github.com/Equicord/Equicord), and [Vencord](https://github.com/Vendicated/Vencord). It does not need BetterDiscord or BDFDB.

## Install

You need a source checkout of your client, Node.js, and the pnpm version required by that checkout.

1. In your client checkout, create `src/userplugins/RoundedVcPfp/`.
2. For **TestCord or Equicord**, copy this repository's `index.tsx` and `style.css` into that folder. For **Vencord**, copy `vencord/index.tsx` and `vencord/style.css` instead. The resulting paths are `<client>/src/userplugins/RoundedVcPfp/index.tsx` and `<client>/src/userplugins/RoundedVcPfp/style.css`.
3. From the client checkout, run `pnpm install` if dependencies are not installed, then `pnpm build`.
4. If this is a new client installation, follow that client's desktop injection instructions (`pnpm inject` in current source checkouts). Restart Discord to load the new build.
5. Open Discord **User Settings -> TestCord, Equicord, or Vencord -> Plugins -> RoundedVCPFP**. Enable it and set the corner radius.

If the client is already injected, step 4 only needs a Discord restart. Building a user plugin does not install it into an existing running Discord window.

## Settings

- **Corner radius**: 0-24 px, default 12. Set to 0 for the original square look.

## Client support

TestCord and Equicord use the files in the repository root; Vencord uses the copies under `vencord/`. These are visual plugins only and change nothing server-side.

## Notes

- Fork of Equicord's `fullVcPfp` by mochienya. It carries the fix that always resolves a loadable avatar URL, which prevents blank tiles caused by the guild-member branch of `getUserAvatarUrl` returning nothing.
- Rounds three layers: the tile surface (`div[data-selenium-video-tile]`, `videoWrapper`, `media-engine-video`, `video`), any full-bleed art on the tile, and the profile picture itself through a centered rounded-square mask, so letterboxed square avatars get rounded corners too.

## License

GPL-3.0-or-later, inherited from Equicord's FullVCPFP. See [LICENSE](LICENSE).
