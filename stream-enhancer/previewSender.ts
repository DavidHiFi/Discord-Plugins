/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { FluxDispatcher, RestAPI, UserStore } from "@webpack/common";

// Posts the custom cover as the stream preview ourselves, so the first preview is the
// spoof as soon as the stream starts, instead of waiting for Discord's upload timer.

interface PreviewSenderHooks {
    isEnabled: () => boolean;
    getThumbnail: () => string | null;
    getIntervalMs: () => number;
}

interface StreamEvent {
    streamKey?: string;
}

const logger = new Logger("StreamEnhancer");

const FIRST_POST_DELAY_MS = 1000;
const THUMBNAIL_RETRY_MS = 2000;
const COVER_CHANGE_MIN_GAP_MS = 5000;
const RATE_LIMIT_FALLBACK_MS = 15000;
// Discord has not been shown to accept faster preview updates than this.
const MIN_POST_INTERVAL_MS = 30000;

let hooks: PreviewSenderHooks | null = null;
let ownStreamKey: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastPostedAt = 0;
let blockedUntil = 0;

// Stream keys are "call:<channel>:<user>" or "guild:<guild>:<channel>:<user>".
const isOwnStreamKey = (streamKey: string) => {
    const parts = streamKey.split(":");
    return parts[parts.length - 1] === UserStore.getCurrentUser()?.id;
};

const clearTimer = () => {
    if (timer != null) clearTimeout(timer);
    timer = null;
};

const schedule = (delayMs: number) => {
    clearTimer();
    const wait = Math.max(delayMs, blockedUntil - Date.now(), 0);
    timer = setTimeout(() => {
        timer = null;
        void postPreview();
    }, wait);
};

const getRetryAfterMs = (error: unknown) => {
    const seconds = (error as { body?: { retry_after?: number; }; })?.body?.retry_after;
    return typeof seconds === "number" && seconds > 0 ? seconds * 1000 : RATE_LIMIT_FALLBACK_MS;
};

const postPreview = async () => {
    if (ownStreamKey == null || hooks == null) return;

    if (!hooks.isEnabled()) return;

    const thumbnail = hooks.getThumbnail();
    if (thumbnail == null) {
        // The cover is still loading. previewCoverChanged() also runs when it arrives.
        schedule(THUMBNAIL_RETRY_MS);
        return;
    }

    const streamKey = ownStreamKey;
    try {
        await RestAPI.post({
            url: `/streams/${encodeURIComponent(streamKey)}/preview`,
            body: { thumbnail }
        });
        lastPostedAt = Date.now();
        logger.info("Stream preview posted.");
    } catch (error) {
        blockedUntil = Date.now() + getRetryAfterMs(error);
        logger.warn("Stream preview post failed; backing off.", error);
    }

    if (ownStreamKey === streamKey) schedule(Math.max(hooks.getIntervalMs(), MIN_POST_INTERVAL_MS));
};

const handleStreamCreate = ({ streamKey }: StreamEvent) => {
    if (!streamKey || !hooks?.isEnabled() || !isOwnStreamKey(streamKey)) return;

    ownStreamKey = streamKey;
    schedule(FIRST_POST_DELAY_MS);
};

const handleStreamDelete = ({ streamKey }: StreamEvent) => {
    if (!streamKey || !isOwnStreamKey(streamKey)) return;

    ownStreamKey = null;
    clearTimer();
};

export const previewCoverChanged = () => {
    if (ownStreamKey == null || hooks == null || !hooks.isEnabled()) return;

    const wait = Math.max(lastPostedAt + COVER_CHANGE_MIN_GAP_MS - Date.now(), 0);
    schedule(wait);
};

export const startPreviewSender = (next: PreviewSenderHooks) => {
    hooks = next;
    FluxDispatcher.subscribe("STREAM_CREATE", handleStreamCreate);
    FluxDispatcher.subscribe("STREAM_DELETE", handleStreamDelete);
};

export const stopPreviewSender = () => {
    FluxDispatcher.unsubscribe("STREAM_CREATE", handleStreamCreate);
    FluxDispatcher.unsubscribe("STREAM_DELETE", handleStreamDelete);
    clearTimer();
    ownStreamKey = null;
    hooks = null;
};
