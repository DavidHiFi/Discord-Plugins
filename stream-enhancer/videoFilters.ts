/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getOutgoingVideoFilterEnabled } from "./settings";
import { getOutgoingStreamFilterString } from "./state";

type FilterProvider = () => string | null;

type ManagedVideoStream = {
    cleanup: () => void;
    track: MediaStreamTrack;
};

const managedVideoStreams = new WeakMap<MediaStream, ManagedVideoStream>();
const activeManagedVideoStreams = new Set<ManagedVideoStream>();

let interceptorVersion = 0;
let restoreVideoInterceptor: (() => void) | null = null;

let filterHost: HTMLElement | null = null;

const getFilterHost = () => {
    if (filterHost?.isConnected) return filterHost;

    const host = document.createElement("div");
    host.setAttribute("data-vc-stream-enhancer-video-filter", "");
    host.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0;overflow:hidden;";
    document.body.appendChild(host);
    filterHost = host;
    return host;
};

const dropFilterHost = () => {
    filterHost?.remove();
    filterHost = null;
};

const evenDimension = (value: number | undefined, fallback: number) => {
    const measured = Math.round(value ?? 0);
    const size = Number.isFinite(measured) && measured > 0 ? measured : fallback;
    return size % 2 === 0 ? size : size + 1;
};

const isNeutralFilter = (filter: string | null | undefined) =>
    filter == null || filter.trim() === "" || filter.trim() === "none";

// Do not put an unfiltered camera or screen share through a canvas. Apart from
// wasting CPU, a blank canvas frame can make the local preview and remote video
// appear gray on clients that do not support manual canvas frame requests.
export const shouldWrapOutgoingVideoFilter = (filter: string | null | undefined) => !isNeutralFilter(filter);

// captureStream(0) relies on CanvasCaptureMediaStreamTrack.requestFrame(), which
// is missing in some Chromium/Electron builds. A positive rate keeps the canvas
// track flowing there as well; follow the source rate when it is available.
export const getCanvasCaptureFrameRate = (frameRate: unknown) => {
    const numeric = typeof frameRate === "number" && Number.isFinite(frameRate) && frameRate > 0
        ? frameRate
        : 30;
    return Math.min(120, Math.max(1, Math.round(numeric)));
};

type ManualFrameTrack = MediaStreamTrack & { requestFrame?: () => void };

const createFilteredVideoTrack = (source: MediaStreamTrack, getFilter: FilterProvider): ManagedVideoStream | null => {
    if (typeof document === "undefined" || typeof MediaStream === "undefined") return null;

    const settings = typeof source.getSettings === "function" ? source.getSettings() : {};
    const canvas = document.createElement("canvas");
    canvas.width = evenDimension(settings.width, 1280);
    canvas.height = evenDimension(settings.height, 720);

    const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (context == null) return null;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    // Marks this as the plugin's own filter sink so stream discovery can never mistake it
    // for a real stream, and so it is skipped when locating what to apply a fit mode to.
    video.dataset.vcStreamEnhancerFilterSink = "";
    video.srcObject = new MediaStream([source]);
    getFilterHost().appendChild(video);
    void video.play().catch(() => { });

    let canvasStream: MediaStream;
    try {
        if (typeof canvas.captureStream !== "function") {
            video.remove();
            return null;
        }
        canvasStream = canvas.captureStream(getCanvasCaptureFrameRate(settings.frameRate));
    } catch {
        video.remove();
        return null;
    }

    const outputTrack = canvasStream.getVideoTracks()[0];
    if (outputTrack == null) {
        video.remove();
        return null;
    }

    let stopped = false;
    let lastTime = -1;
    let lastFilter: string | null = null;
    let animationHandle = 0;
    let frameCallbackHandle = 0;

    const draw = () => {
        if (stopped) return;

        const time = video.currentTime;
        const filter = getFilter() ?? null;
        const sourceReady = video.videoWidth > 0 && video.videoHeight > 0;

        if (sourceReady && (time !== lastTime || filter !== lastFilter)) {
            if (video.videoWidth !== canvas.width || video.videoHeight !== canvas.height) {
                canvas.width = evenDimension(video.videoWidth, canvas.width);
                canvas.height = evenDimension(video.videoHeight, canvas.height);
            }

            context.filter = isNeutralFilter(filter) ? "none" : filter!;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            lastTime = time;
            lastFilter = filter;
            (outputTrack as ManualFrameTrack).requestFrame?.();
        }
    };

    const pumpWithAnimationFrame = () => {
        if (stopped) return;
        draw();
        animationHandle = requestAnimationFrame(pumpWithAnimationFrame);
    };

    const supportsFrameCallback = typeof video.requestVideoFrameCallback === "function";
    const pumpWithVideoFrameCallback = () => {
        if (stopped) return;
        draw();
        frameCallbackHandle = video.requestVideoFrameCallback(pumpWithVideoFrameCallback);
    };

    const watchdog = window.setInterval(draw, 250);

    if (supportsFrameCallback) pumpWithVideoFrameCallback();
    else pumpWithAnimationFrame();

    const managed: ManagedVideoStream = {
        track: outputTrack,
        cleanup: () => {
            if (stopped) return;
            stopped = true;

            clearInterval(watchdog);
            if (animationHandle) cancelAnimationFrame(animationHandle);
            if (frameCallbackHandle && typeof video.cancelVideoFrameCallback === "function") {
                video.cancelVideoFrameCallback(frameCallbackHandle);
            }

            for (const track of canvasStream.getTracks()) {
                track.onended = null;
                track.stop();
            }

            video.pause();
            video.srcObject = null;
            video.remove();

            activeManagedVideoStreams.delete(managed);
            if (activeManagedVideoStreams.size === 0) dropFilterHost();
        }
    };

    activeManagedVideoStreams.add(managed);
    source.addEventListener("ended", managed.cleanup, { once: true });
    outputTrack.addEventListener("ended", managed.cleanup, { once: true });

    return managed;
};

export const wrapStreamVideo = (stream: MediaStream, getFilter: FilterProvider): MediaStream => {
    if (!shouldWrapOutgoingVideoFilter(getFilter())) return stream;

    const source = stream.getVideoTracks()[0];
    if (source == null || managedVideoStreams.has(stream)) return stream;

    const managed = createFilteredVideoTrack(source, getFilter);
    if (managed == null) return stream;

    managedVideoStreams.set(stream, managed);

    const others = stream.getTracks().filter(track => track !== source);
    return new MediaStream([...others, managed.track]);
};

const wantsVideo = (constraints: MediaStreamConstraints | undefined) =>
    constraints?.video != null && constraints.video !== false;

export const installOutgoingVideoFilterInterceptor = () => {
    if (restoreVideoInterceptor) return;
    if (typeof navigator === "undefined" || navigator.mediaDevices == null) return;

    const mediaDevices = navigator.mediaDevices as MediaDevices & {
        getDisplayMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
    };
    const restoreCallbacks: Array<() => void> = [];
    const installVersion = ++interceptorVersion;
    const getFilter: FilterProvider = () => (getOutgoingVideoFilterEnabled() ? getOutgoingStreamFilterString() : null);

    const originalGetUserMedia = mediaDevices.getUserMedia;
    if (originalGetUserMedia) {
        mediaDevices.getUserMedia = function (constraints) {
            const request = originalGetUserMedia.call(this, constraints);
            return wantsVideo(constraints) ? request.then(stream => wrapStreamVideo(stream, getFilter)) : request;
        };
        restoreCallbacks.push(() => {
            mediaDevices.getUserMedia = originalGetUserMedia;
        });
    }

    const originalGetDisplayMedia = mediaDevices.getDisplayMedia;
    if (originalGetDisplayMedia) {
        mediaDevices.getDisplayMedia = function (constraints) {
            const request = originalGetDisplayMedia.call(this, constraints);
            return request.then(stream => wrapStreamVideo(stream, getFilter));
        };
        restoreCallbacks.push(() => {
            mediaDevices.getDisplayMedia = originalGetDisplayMedia;
        });
    }

    if (!restoreCallbacks.length) {
        interceptorVersion++;
        return;
    }

    if (interceptorVersion !== installVersion) {
        for (const restore of restoreCallbacks) restore();
        return;
    }

    restoreVideoInterceptor = () => {
        interceptorVersion++;
        for (const restore of restoreCallbacks) restore();
        restoreVideoInterceptor = null;

        for (const managed of [...activeManagedVideoStreams]) managed.cleanup();
        dropFilterHost();
    };
};

export const uninstallOutgoingVideoFilterInterceptor = () => {
    restoreVideoInterceptor?.();
};

export const hasActiveOutgoingVideoFilter = () => activeManagedVideoStreams.size > 0;
