import assert from "node:assert/strict";
import { test } from "node:test";

import {
    advertiseStreams,
    badgeFps,
    badgeResolution,
    encodingOverride,
    goLiveSource,
    keyframeInterval,
    maxBitrate,
    patchConstraints,
    QualitySettings,
    videoCodec
} from "../src/quality";

const base: QualitySettings = {
    fpsEnabled: true, fps: 60,
    resolutionEnabled: true, resolution: 1080, resolutionWidth: "1920", resolutionHeight: "1080",
    bitrateEnabled: true, bitrate: 5000,
    codecEnabled: false, videoCodec: "H264",
    keyframeIntervalEnabled: false, keyframeInterval: 0,
    hdrEnabled: false,
    spoofBadgeEnabled: true, spoofBadgeResolution: 4320,
    spoofBadgeWidth: "7680", spoofBadgeHeight: "4320", spoofBadgeFps: 360
};

const off: QualitySettings = { ...base, fpsEnabled: false, resolutionEnabled: false, bitrateEnabled: false, spoofBadgeEnabled: false };

function discordStreams() {
    return [{ type: "screen", rid: "100", ssrc: 5, rtxSsrc: 6, quality: 100, active: true, maxBitrate: 2500000, maxFrameRate: 30, maxResolution: { type: "fixed", width: 1280, height: 720 } }];
}

test("gateway gets 8K 360 while Discord's own parameters keep the real stream", () => {
    const streams = discordStreams();
    const sent = advertiseStreams(streams, base) as any[];
    assert.deepEqual(sent[0].maxResolution, { type: "fixed", width: 7680, height: 4320 });
    assert.equal(sent[0].maxFrameRate, 360);
    assert.equal(sent[0].ssrc, 5);
    assert.equal(streams[0].maxFrameRate, 30);
    assert.deepEqual(streams[0].maxResolution, { type: "fixed", width: 1280, height: 720 });
});

test("encoder stays at 1080p 60 while the badge says 8K 360", () => {
    const result = patchConstraints({ quality: { capture: { width: 1280, height: 720, framerate: 30 }, encode: { width: 1280, height: 720, framerate: 30 }, bitrateMax: 1 }, constraints: {} as Record<string, any> }, base);
    assert.equal(result.constraints.encodingVideoWidth, 1920);
    assert.equal(result.constraints.encodingVideoHeight, 1080);
    assert.equal(result.constraints.encodingVideoFrameRate, 60);
    assert.equal(result.constraints.encodingVideoBitRate, 5000000);
    assert.equal(result.quality.encode.pixelCount, 1920 * 1080);
    assert.deepEqual(encodingOverride(1280, 720, 30, base), [1920, 1080, 60]);
});

test("patchConstraints copies Discord's cached quality object", () => {
    const cached = { capture: { width: 1280, height: 720, framerate: 30 }, encode: { width: 1280, height: 720, framerate: 30 } };
    patchConstraints({ quality: cached, constraints: {} }, base);
    assert.equal(cached.capture.width, 1280);
});

test("badge on your own tile matches the viewer badge", () => {
    assert.equal(badgeFps(30, base), 360);
    assert.deepEqual(badgeResolution({ type: "fixed", width: 0, height: 720 }, base), { type: "fixed", width: 7680, height: 4320 });
});

test("spoof off advertises the real override", () => {
    const s = { ...base, spoofBadgeEnabled: false };
    const sent = advertiseStreams(discordStreams(), s) as any[];
    assert.equal(sent[0].maxFrameRate, 60);
    assert.equal(sent[0].maxResolution.height, 1080);
    assert.equal(badgeFps(30, s), 60);
});

test("everything off leaves Discord's values alone", () => {
    const streams = discordStreams();
    assert.equal(advertiseStreams(streams, off), streams);
    const result = { quality: { capture: { width: 1 } }, constraints: { encodingVideoBitRate: 7 } };
    assert.equal(patchConstraints(result, off), result);
    assert.deepEqual(encodingOverride(1280, 720, 30, off), [1280, 720, 30]);
    assert.equal(maxBitrate(3500000, off), 3500000);
    assert.equal(badgeFps(30, off), 30);
});

test("spoof works with the real overrides turned off", () => {
    const s = { ...off, spoofBadgeEnabled: true };
    const sent = advertiseStreams(discordStreams(), s) as any[];
    assert.equal(sent[0].maxFrameRate, 360);
    assert.equal(sent[0].maxBitrate, 2500000);
    assert.deepEqual(encodingOverride(1280, 720, 30, s), [1280, 720, 30]);
});

test("audio entries and custom sizes", () => {
    const s = { ...base, spoofBadgeResolution: 0, spoofBadgeWidth: "5120", spoofBadgeHeight: "2880" };
    const sent = advertiseStreams([{ type: "audio", ssrc: 1 }, ...discordStreams()], s) as any[];
    assert.deepEqual(sent[0], { type: "audio", ssrc: 1 });
    assert.equal(sent[1].maxResolution.width, 5120);
    const bad = { ...base, resolution: 0, resolutionWidth: "abc", resolutionHeight: "-4" };
    assert.deepEqual(encodingOverride(1, 1, 1, bad), [1920, 1080, 60]);
});

test("codec, keyframe and HDR only change when enabled", () => {
    const codecs = [{ type: "video", name: "H264", encode: true }, { type: "video", name: "AV1", encode: true }, { type: "video", name: "VP9", encode: false }];
    assert.equal(videoCodec("H264", codecs, base), "H264");
    assert.equal(videoCodec("H264", codecs, { ...base, codecEnabled: true, videoCodec: "AV1" }), "AV1");
    assert.equal(videoCodec("H264", codecs, { ...base, codecEnabled: true, videoCodec: "VP9" }), "H264");
    assert.equal(keyframeInterval(0, base), 0);
    assert.equal(keyframeInterval(0, { ...base, keyframeIntervalEnabled: true, keyframeInterval: 2000 }), 2000);
    const source = { desktopDescription: { id: "screen:0", hdrCaptureMode: "never" } };
    assert.equal(goLiveSource(source, base), source);
    const hdr = goLiveSource(source, { ...base, hdrEnabled: true });
    assert.equal(hdr.desktopDescription.hdrCaptureMode, "always");
    assert.equal(source.desktopDescription.hdrCaptureMode, "never");
});
