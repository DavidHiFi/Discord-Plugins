# RoundedVcPfp

Rounded full-resolution avatars on call tiles, with three sliders, a background switch and a customizable glow:

- Profile picture corner rounding shapes the avatar itself (0-52 %, default 5; 0 is a flat square like FullVCPFP, 50 and higher is a full circle, and the rounding scales with the picture).
- Tile corner radius shapes the whole tile box in pixels (0-52 px, default 12).
- Avatar zoom scales the picture inside the tile (25-100 %, default 100; lower values zoom the picture out inside the tile and the rounded corners scale with it).
- Turn off the tile background removes the background box behind profile pictures so only the picture shows; focus and speaking highlights are hidden with it, and stream tiles keep their video.
- Turn the glow on shapes a two-layer glow that trails the masked picture outline (radius, zoom and mask all carry along); it applies when the background switch is on.
- Glow color takes the hex code of that glow, for example #45475a; the glow mixes its own transparency levels, so an alpha channel in the hex is ignored.

The halo keeps fading past the tile edges: the stylesheet releases the tile's two clipping levels for picture tiles while the box is hidden, so there is no straight cut line against the voice panel.

Changes apply when affected tiles re-render (layout changes, speaking state, participants changing) rather than the same frame.

Copy the source files in this folder to `src/userplugins/RoundedVcPfp` in a compatible TestCord checkout, then build the client. Preserve the original author metadata and license headers. This copy is published as part of the maintained collection. See the root README for installation and validation limits.

License: GPL-3.0-or-later. See LICENSE.
