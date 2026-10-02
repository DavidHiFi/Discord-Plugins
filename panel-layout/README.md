# PanelLayout

The maintained TestCord panel layout. The footer shows native voice latency during calls and gateway heartbeat latency otherwise. Voice readings older than 30 seconds are marked old. Missing readings use a neutral status dot.

Copy the source files in this folder to `src/testcordplugins/PanelLayout` in a compatible TestCord checkout, then build the client. Preserve the original author metadata and license headers. This copy is published as part of the maintained collection. See the root README for installation and validation limits.

License: GPL-3.0-or-later. See LICENSE.

Run `node tests/panel-layout-ping.cjs` from the repository root after installing its development dependencies. Eleven checks cover voice updates, gateway fallback, stale samples and unavailable readings. On 2026-10-03, six live samples matched the footer to native voice latency at 76 ms and 66 ms.
