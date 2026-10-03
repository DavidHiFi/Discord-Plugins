const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");
const root = path.join(__dirname, "../stream-enhancer");

function load(file, globals = {}) {
    const code = esbuild.transformSync(fs.readFileSync(path.join(root, file), "utf8"), { loader: "ts", format: "cjs" }).code;
    const module = { exports: {} };
    const sandbox = { module, exports: module.exports, ...globals };
    vm.runInNewContext(code, sandbox);
    return module.exports;
}

const { normalizeBadgeConfig, advertiseBadge, badgeFps, badgeResolution } = load("badge.ts");
const config = normalizeBadgeConfig({ spoofBadgeEnabled: true });
const video = Object.freeze({ maxResolution: Object.freeze({ type: "fixed", width: 1920, height: 1080 }), maxFrameRate: 60, maxBitrate: 12000000 });
const audio = Object.freeze({ type: "audio", maxBitrate: 192000 });
const streams = Object.freeze([video, audio]);
const out = advertiseBadge({ context: "stream" }, streams, config);
assert.equal(out[0].maxResolution.height, 4320);
assert.equal(out[0].maxResolution.width, 7680);
assert.equal(out[0].maxFrameRate, 360);
assert.equal(out[0].maxBitrate, video.maxBitrate);
assert.equal(video.maxResolution.height, 1080);
assert.equal(video.maxFrameRate, 60);
assert.equal(out[1], audio);
assert.equal(advertiseBadge({ context: "default" }, streams, config), streams);
assert.equal(advertiseBadge({ context: "stream" }, streams, normalizeBadgeConfig({})), streams);
assert.equal(advertiseBadge({ context: "stream" }, null, config), null);
assert.equal(badgeFps(60, config), 360);
assert.equal(badgeFps(60, normalizeBadgeConfig({})), 60);
const local = Object.freeze({ width: 1920, height: 1080, type: 0 });
assert.equal(badgeResolution(local, normalizeBadgeConfig({})), local);
assert.equal(badgeResolution(local, config).height, out[0].maxResolution.height);
assert.equal(badgeResolution(local, config).type, 0);
const invalid = normalizeBadgeConfig({ spoofBadgeWidth: NaN, spoofBadgeHeight: Infinity, spoofBadgeFps: -5 });
assert.equal(invalid.spoofBadgeWidth, 7680);
assert.equal(invalid.spoofBadgeHeight, 4320);
assert.equal(invalid.spoofBadgeFps, 1);
assert.equal(normalizeBadgeConfig({ spoofBadgeFps: 2000 }).spoofBadgeFps, 1000);

const state = fs.readFileSync(path.join(root, "state.ts"), "utf8");
const cameraCode = state.slice(state.indexOf("const CameraVideo ="), state.indexOf("// useStateFromStores compares results"));
const native = {};
const cameraSandbox = {
    module: { exports: {} },
    findComponentByCodeLazy: query => {
        assert.equal(query, 'location:"VideoStream"');
        return native;
    },
    React: { createElement: (component, props) => ({ component, props }) }
};
vm.runInNewContext(esbuild.transformSync(cameraCode, { loader: "ts", format: "cjs" }).code, cameraSandbox);
const render = cameraSandbox.module.exports.renderZoomableCameraVideo;
for (const mirror of [true, false]) {
    const props = { streamId: "camera-stream", videoComponent: {}, mirror, videoSpinnerContext: mirror ? "SELF_VIDEO" : "REMOTE_VIDEO", fit: "contain", paused: false };
    const result = render(props, 1n);
    assert.equal(result.component, native);
    for (const [key, value] of Object.entries(props)) assert.equal(result.props[key], value);
    assert.equal(result.props.key, "1");
}
assert.equal(render({}, null).props.key, undefined);

// The Discord CSS module class controls the actual video element's dimensions.
// Both camera and screen-share patches must retain it alongside our fit class.
const mergeStart = state.indexOf("export const mergeRenderedStreamVideoClassName =");
const mergeEnd = state.indexOf("\n\n// Returns the className to inject", mergeStart);
assert.notEqual(mergeStart, -1);
assert.notEqual(mergeEnd, -1);
const mergeCode = state.slice(mergeStart, mergeEnd);
const mergeModule = { exports: {} };
vm.runInNewContext(esbuild.transformSync(mergeCode, { loader: "ts", format: "cjs" }).code, {
    module: mergeModule,
    exports: mergeModule.exports,
    classes: (...values) => values.filter(Boolean).join(" ")
});
const mergeVideoClassName = mergeModule.exports.mergeRenderedStreamVideoClassName;
assert.equal(mergeVideoClassName("discord-video", "vc-stream-enhancer-video-contain"), "discord-video vc-stream-enhancer-video-contain");
assert.equal(mergeVideoClassName(undefined, "vc-stream-enhancer-video-contain"), "vc-stream-enhancer-video-contain");

const { streamEnhancerPatches } = load("patches.ts");
const cameraPatch = streamEnhancerPatches.find(patch => patch.find === "REMOTE_VIDEO,paused:");
const cameraClassPatch = cameraPatch.replacement.find(replacement => replacement.match.source.includes("className"));
assert.match(cameraClassPatch.replace, /mergeRenderedStreamVideoClassName\(\$1,vcState\.className\)/);
const streamTilePatch = streamEnhancerPatches.find(patch => patch.find === "Stream Tile State");
const streamTileClassPatch = streamTilePatch.replacement.find(replacement => replacement.match.source.includes("videoComponent"));
assert.match(streamTileClassPatch.replace, /mergeRenderedStreamVideoClassName\(\$1,vcState\.className\)/);
const streamTileClassPattern = new RegExp(streamTileClassPatch.match.source.replaceAll("\\i", "(?:[A-Za-z_$][\\w$]*)"), streamTileClassPatch.match.flags);
const patchedStreamTileClass = "className:v.video,streamId:id,videoComponent:component,fit:fit,paused:paused".replace(
    streamTileClassPattern,
    streamTileClassPatch.replace.replaceAll("$self", "Plugin")
);
assert.match(patchedStreamTileClass, /className:Plugin\.mergeRenderedStreamVideoClassName\(v\.video,vcState\.className\)/);

function applyPatch(code, patch) {
    for (const replacement of [].concat(patch.replacement)) {
        const pattern = new RegExp(replacement.match.source.replaceAll("\\i", "(?:[A-Za-z_$][\\w$]*)"), replacement.match.flags);
        assert.equal([...code.matchAll(new RegExp(pattern.source, "g"))].length, 1, `${patch.find}: ${pattern}`);
        code = code.replace(pattern, replacement.replace.replaceAll("$self", "Plugin"));
    }
    return code;
}

// Exercise the complete self/remote camera call-site rewrite using a minified
// shape where the participant is deliberately not named `t`.
const remoteCameraFixture = "function A(e){let{participant:p,channel:c,inCall:i,width:w,selected:s,popoutType:o,fit:f,onVideoResize:r,blocked:b,ignored:g,noVideoRender:n=!1}=e,unused=0;return (0,x.jsx)(y.A,{onResize:r,wrapperClassName:s!==t.T.CALL_TILE?u.x:void 0,className:v.video,mirror:!0,fit:f,videoSpinnerContext:c})}";
const patchedRemoteCamera = applyPatch(remoteCameraFixture, cameraPatch);
assert.match(patchedRemoteCamera, /vcStreamKey=p\?\.id/);
assert.match(patchedRemoteCamera, /streamKey:vcStreamKey/);
assert.match(patchedRemoteCamera, /mergeRenderedStreamVideoClassName\(v\.video,vcState\.className\)/);
assert.doesNotMatch(patchedRemoteCamera, /streamKey:t\.id/);
assert.doesNotThrow(() => new Function("Plugin", `return (${patchedRemoteCamera})`));

const videoFilters = load("videoFilters.ts", {
    require(id) {
        if (id === "./settings") return { getOutgoingVideoFilterEnabled: () => true };
        if (id === "./state") return { getOutgoingStreamFilterString: () => null };
        throw new Error(`Unexpected import: ${id}`);
    }
});
assert.equal(videoFilters.shouldWrapOutgoingVideoFilter(null), false);
assert.equal(videoFilters.shouldWrapOutgoingVideoFilter(undefined), false);
assert.equal(videoFilters.shouldWrapOutgoingVideoFilter("  "), false);
assert.equal(videoFilters.shouldWrapOutgoingVideoFilter("none"), false);
assert.equal(videoFilters.shouldWrapOutgoingVideoFilter("contrast(118%)"), true);
assert.equal(videoFilters.getCanvasCaptureFrameRate(undefined), 30);
assert.equal(videoFilters.getCanvasCaptureFrameRate(59.8), 60);
assert.equal(videoFilters.getCanvasCaptureFrameRate(0), 30);
assert.equal(videoFilters.getCanvasCaptureFrameRate(240), 120);

if (process.env.STREAM_ENHANCER_MODULES) {
    const { modules } = JSON.parse(fs.readFileSync(process.env.STREAM_ENHANCER_MODULES, "utf8"));
    for (const find of ['REMOTE_VIDEO,paused:', '"useMaxQuality"', "this._sentVideo&&", "Stream Tile State", 'location:"VideoStream"']) {
        const patch = streamEnhancerPatches.find(p => p.find === find);
        const term = find.replaceAll('"', '');
        const found = modules[term];
        assert.equal(found.length, 1, `one live module for ${find}`);
        let code = found[0].code;
        for (const replacement of [].concat(patch.replacement)) {
            const match = new RegExp(replacement.match.source.replaceAll("\\i", "(?:[A-Za-z_$][\\w$]*)"), replacement.match.flags);
            assert.equal([...code.matchAll(new RegExp(match.source, "g"))].length, 1, `${find}: ${match}`);
            code = code.replace(match, replacement.replace.replaceAll("$self", "Vencord.Plugins.plugins.StreamEnhancer"));
        }
        assert.doesNotThrow(() => new Function(`return ({${code}})`));
    }
}
console.log("StreamEnhancer spoofed badge isolation, camera class retention, native self/remote rendering, and video-filter pass-through checks passed.");
