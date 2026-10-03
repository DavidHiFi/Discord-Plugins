/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface BadgeConfig {
    spoofBadgeEnabled: boolean;
    spoofBadgeWidth: number;
    spoofBadgeHeight: number;
    spoofBadgeFps: number;
}

export function normalizeBadgeConfig(source: Partial<BadgeConfig>): BadgeConfig {
    const bounded = (value: number | undefined, fallback: number, max: number) =>
        Number.isFinite(value) ? Math.min(max, Math.max(1, Math.round(value ?? fallback))) : fallback;
    return {
        spoofBadgeEnabled: source.spoofBadgeEnabled === true,
        spoofBadgeWidth: bounded(source.spoofBadgeWidth, 7680, 16384),
        spoofBadgeHeight: bounded(source.spoofBadgeHeight, 4320, 16384),
        spoofBadgeFps: bounded(source.spoofBadgeFps, 360, 1000)
    };
}

export function advertiseBadge(rtc: { context?: string; }, streams: unknown, config: BadgeConfig): unknown {
    if (rtc.context !== "stream" || !config.spoofBadgeEnabled || !Array.isArray(streams)) return streams;
    return streams.map(stream => {
        if (stream == null || typeof stream !== "object" || !("maxResolution" in stream || "maxFrameRate" in stream)) return stream;
        return {
            ...stream,
            maxResolution: { type: "fixed", width: config.spoofBadgeWidth, height: config.spoofBadgeHeight },
            maxPixelCount: config.spoofBadgeWidth * config.spoofBadgeHeight,
            maxFrameRate: config.spoofBadgeFps
        };
    });
}

export function badgeFps(fps: number, config: BadgeConfig): number {
    return config.spoofBadgeEnabled ? config.spoofBadgeFps : fps;
}

export function badgeResolution<T extends { width: number; height: number; type: number; }>(resolution: T, config: BadgeConfig): T {
    return config.spoofBadgeEnabled
        ? { ...resolution, width: config.spoofBadgeWidth, height: config.spoofBadgeHeight, type: 0 }
        : resolution;
}
