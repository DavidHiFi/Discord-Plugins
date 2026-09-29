# Dopamine RPC companion

This companion patches a Dopamine 3 archive to publish cover artwork and a playback clock for LyricsStatus. The archive patch depends on Dopamine's bundled code. Audit the installed version before building a replacement.

The patcher has legacy maintainer-specific path defaults. Set all of these environment variables before running it:

| Variable | Your value |
| --- | --- |
| TESTCORD_DIR | Your TestCord source checkout with `@electron/asar` installed. |
| DOPAMINE_RESOURCES | Your installed Dopamine `resources` directory. |
| DOPAMINE_PATCH_ROOT | A writable working directory for staging and rollback backups. |

With those variables set, run from this folder:

```sh
node patch-asar.cjs audit
node patch-asar.cjs build
```

Review the audit and generated files. Close Dopamine yourself before `node patch-asar.cjs install`. The patcher writes a rollback backup. `node patch-asar.cjs rollback` restores it. Do not interrupt playback or a routed audio session to install this companion.

`artwork.cjs` is the RPC helper. `test-helper.cjs` tests helper behavior. `test-patch.cjs` is a legacy maintainer fixture with hardcoded archive paths; adapt those paths for your local staged archive before use. These tests do not establish that another Dopamine version can be patched.

GPL-3.0-or-later. See the parent folder's LICENSE and source attribution.
