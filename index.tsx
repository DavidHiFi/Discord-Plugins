/* eslint-disable simple-header/header -- This standalone user plugin is MIT licensed. */
/*
 * MicSpamGuard
 * Copyright (c) 2026 DavidHiFi
 * SPDX-License-Identifier: MIT
 *
 * Rebuilt on the media engine stats the desktop client actually provides,
 * with snap settings, a user area button, a dynamic user volume mode and
 * a live panel that follows voice channel membership.
 */

import { DataStore } from "@api/index";
import { plugins } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { openPluginModal } from "@components/settings";
import { Logger } from "@utils/Logger";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Button, MediaEngineStore, React, RelationshipStore, SelectedChannelStore, showToast, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

const logger = new Logger("MicSpamGuard");

const IGNORED_KEY = "MicSpamGuard_ignored";
const HELD_KEY = "MicSpamGuard_held_volumes";
const POLL_MS = 500;
const STALE_MS = 3000;
const LOUD_WINDOW_MS = 6000;
const TRIGGER_COOLDOWN_MS = 3000;
const LEVEL_FLOOR_DB = -45;
const ATTACK_TAU_MS = 150;
const RELEASE_TAU_MS = 800;

const MIC_GUARD_KEYS = ["enabled"] as const;

interface VoiceConnection {
    context: string;
    emitter?: {
        on?: (event: string, handler: (...args: any[]) => void) => void;
        off?: (event: string, handler: (...args: any[]) => void) => void;
    };
    localMutes?: Record<string, boolean>;
    getUserIdBySsrc?: (ssrc: number) => string | null;
}

interface InboundSample {
    userId: string;
    entry: Record<string, any>;
}

interface TurnedDown {
    base: number;
    volume: number;
    applied: number;
    at: number;
}

const levels = new Map<string, number>();
const levelAt = new Map<string, number>();
const loudAt = new Map<string, number[]>();
const lastTriggerAt = new Map<string, number>();
const mutedByUs = new Map<string, number>();
const turnedDown = new Map<string, TurnedDown>();
const ignored = new Set<string>();
const savedVolume = new Map<string, number>();

const { setLocalVolume } = findByPropsLazy("setLocalVolume");

let connection: VoiceConnection | null = null;
let boundConnection: VoiceConnection | null = null;
let intervalId: ReturnType<typeof setInterval> | undefined;

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Watch the call and mute, or turn down, anyone who gets too loud or spams their mic.",
        default: true,
        onChange() {
            if (!settings.store.enabled) {
                unmuteAll("silent");
                restoreAll("silent");
            }
        }
    },
    threshold: {
        type: OptionType.SLIDER,
        description: "How loud someone has to get before the guard reacts. Dynamic User Volume keeps them under this line. The live meter above uses the same scale.",
        markers: makeRange(30, 100, 5),
        default: 70,
        stickToMarkers: true,
        onChange() {
            loudAt.clear();
        }
    },
    sensitivity: {
        type: OptionType.SLIDER,
        description: "How many loud samples are needed before a mute (mute mode only). Higher reacts to shorter sounds.",
        markers: makeRange(1, 10, 1),
        default: 5,
        stickToMarkers: true,
        onChange() {
            loudAt.clear();
        }
    },
    autoUnmute: {
        type: OptionType.SELECT,
        description: "How long they have to STAY QUIET before a guard mute lifts. While they keep being loud the mute holds - no mute/unmute loop. Off keeps them muted until you unmute them. Mute mode only.",
        options: [
            { label: "Off (stay muted)", value: 0 },
            { label: "3 seconds", value: 3 },
            { label: "5 seconds", value: 5 },
            { label: "10 seconds", value: 10, default: true },
            { label: "30 seconds", value: 30 },
            { label: "1 minute", value: 60 },
            { label: "2 minutes", value: 120 },
            { label: "5 minutes", value: 300 }
        ]
    },
    dynamicUserVolume: {
        type: OptionType.BOOLEAN,
        description: "Instead of muting, turn loud people down. Their local volume drops while they're loud and comes back when they quiet down, so they always stay audible - a compressor-style alternative to muting. Off keeps the normal mute behavior.",
        default: false,
        onChange(on: boolean) {
            if (on) unmuteAll("silent");
            else restoreAll("silent");
        }
    },
    dynamicUserVolumeFloor: {
        type: OptionType.SLIDER,
        description: "How far down Dynamic User Volume will ever turn someone while they're loud. They stay audible at this volume; their normal volume always comes back when they stop.",
        markers: makeRange(0, 60, 5),
        default: 20,
        stickToMarkers: true
    },
    ignoreFriends: {
        type: OptionType.BOOLEAN,
        description: "Never mute your friends.",
        default: true
    },
    notify: {
        type: OptionType.BOOLEAN,
        description: "Show a toast when the guard mutes, unmutes, turns someone down, or restores their volume.",
        default: true
    }
});

function displayName(userId: string) {
    const user = UserStore.getUser(userId);
    return user?.globalName ?? user?.username ?? userId;
}

function formatDuration(seconds: number) {
    if (seconds % 60 === 0) {
        const minutes = seconds / 60;
        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function isIgnored(userId: string) {
    if (ignored.has(userId)) return true;
    if (UserStore.getCurrentUser()?.id === userId) return true;

    const user = UserStore.getUser(userId);
    if (user?.bot) return true;

    return settings.store.ignoreFriends && RelationshipStore.isFriend(userId);
}

function isLocalMuted(userId: string) {
    return connection?.localMutes?.[userId] ?? MediaEngineStore.isLocalMute(userId);
}

function currentVoiceMembers(): string[] {
    try {
        const channelId = SelectedChannelStore.getVoiceChannelId();
        if (!channelId) return [];
        return Object.keys(VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {});
    } catch (e) {
        logger.error("failed to read voice channel members", e);
        return [];
    }
}

function turnDownTarget(level: number, base: number) {
    const gainDb = (settings.store.threshold - level) * (-LEVEL_FLOOR_DB / 100);
    const ceiling = 100 * Math.pow(10, gainDb / 20);
    const floor = Math.min(settings.store.dynamicUserVolumeFloor, base);
    return Math.max(floor, Math.min(base, ceiling));
}

function getConnection(): VoiceConnection | null {
    const engine = MediaEngineStore.getMediaEngine();
    if (!engine?.connections) return null;

    for (const conn of engine.connections as Iterable<VoiceConnection>) {
        if (conn?.context === "default") return conn;
    }

    return null;
}

function toPercent(level: number) {
    if (!Number.isFinite(level) || level <= 0) return 0;

    const db = 20 * Math.log10(Math.min(level, 1));
    return Math.max(0, Math.min(100, Math.round(((db - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB) * 100)));
}

function readInbound(payload: any): InboundSample[] {
    const inbound = payload?.rtp?.inbound;
    if (!inbound) return [];

    const samples: InboundSample[] = [];
    const add = (key: unknown, value: unknown) => {
        const entries = Array.isArray(value) ? value : [value];
        for (const entry of entries) {
            if (!entry || typeof entry !== "object") continue;

            const userId = typeof key === "string" && /^\d+$/.test(key)
                ? key
                : connection?.getUserIdBySsrc?.(Number((entry as any).ssrc));
            if (userId) samples.push({ userId, entry: entry as Record<string, any> });
        }
    };

    if (Array.isArray(inbound)) {
        for (const entry of inbound) add(null, entry);
    } else {
        for (const [key, value] of Object.entries(inbound)) add(key, value);
    }

    return samples;
}

function mute(userId: string, level: number) {
    if (settings.store.dynamicUserVolume) return;
    if (mutedByUs.has(userId) || isLocalMuted(userId)) return;

    savedVolume.set(userId, MediaEngineStore.getLocalVolume(userId));
    setLocalVolume(userId, 0);
    mutedByUs.set(userId, Date.now());
    persistHeld();
    logger.debug(`muted ${userId} at ${level}%`);

    if (settings.store.notify) {
        showToast(`MicSpamGuard muted ${displayName(userId)} at ${level}% volume.`, Toasts.Type.MESSAGE);
    }
}

function unmute(userId: string, mode: "manual" | "auto" | "silent") {
    if (!mutedByUs.delete(userId)) return;

    setLocalVolume(userId, savedVolume.get(userId) ?? 100);
    savedVolume.delete(userId);
    persistHeld();

    if (mode === "silent" || !settings.store.notify) return;

    showToast(
        mode === "auto"
            ? `MicSpamGuard auto-unmuted ${displayName(userId)} after ${formatDuration(settings.store.autoUnmute)}.`
            : `MicSpamGuard unmuted ${displayName(userId)}.`,
        Toasts.Type.MESSAGE
    );
}

function restoreVolume(userId: string, mode: "manual" | "silent") {
    const entry = turnedDown.get(userId);
    if (!entry || !turnedDown.delete(userId)) return;

    setLocalVolume(userId, entry.base);
    savedVolume.delete(userId);
    persistHeld();
    logger.debug(`restored ${userId} to ${entry.base}%`);

    if (mode === "silent" || !settings.store.notify) return;

    showToast(`MicSpamGuard restored ${displayName(userId)}'s volume.`, Toasts.Type.MESSAGE);
}

function restoreAll(mode: "manual" | "silent") {
    for (const userId of [...turnedDown.keys()]) restoreVolume(userId, mode);
}

function updateDynamics(now: number) {
    if (!settings.store.dynamicUserVolume) return;

    for (const [userId, entry] of [...turnedDown]) {
        const fresh = now - (levelAt.get(userId) ?? 0) < STALE_MS;
        const level = fresh ? levels.get(userId) ?? 0 : 0;
        const target = isIgnored(userId) || isLocalMuted(userId)
            ? entry.base
            : turnDownTarget(level, entry.base);

        const dt = Math.min(1000, Math.max(0, now - entry.at));
        const tau = target < entry.volume ? ATTACK_TAU_MS : RELEASE_TAU_MS;
        entry.volume += (target - entry.volume) * (1 - Math.exp(-dt / tau));
        entry.at = now;

        const applied = Math.round(entry.volume);
        if (applied !== entry.applied) {
            entry.applied = applied;
            setLocalVolume(userId, applied);
        }

        if (target >= entry.base - 0.5 && entry.volume >= entry.base - 0.5) restoreVolume(userId, "silent");
    }
}

function onStats(payload: any) {
    const now = Date.now();
    const { enabled, threshold, sensitivity, dynamicUserVolume } = settings.store;
    const needed = Math.max(1, Math.round((11 - sensitivity) * 0.4));

    for (const { userId, entry } of readInbound(payload)) {
        const percent = toPercent(Number(entry.audioLevel));
        levels.set(userId, percent);
        levelAt.set(userId, now);

        if (mutedByUs.has(userId) && percent >= threshold) mutedByUs.set(userId, now);

        if (!enabled) continue;

        if (dynamicUserVolume) {
            if (!turnedDown.has(userId) && !isIgnored(userId) && !isLocalMuted(userId)) {
                const base = MediaEngineStore.getLocalVolume(userId);
                const target = turnDownTarget(percent, base);

                if (target < base) {
                    turnedDown.set(userId, { base, volume: base, applied: Math.round(base), at: now });
                    savedVolume.set(userId, base);
                    persistHeld();
                    logger.debug(`turning down ${userId} to ${Math.round(target)}% (base ${base}%)`);

                    if (settings.store.notify && now - (lastTriggerAt.get(userId) ?? 0) > TRIGGER_COOLDOWN_MS) {
                        lastTriggerAt.set(userId, now);
                        showToast(`MicSpamGuard turned down ${displayName(userId)} to ${Math.round(target)}% volume.`, Toasts.Type.MESSAGE);
                    }
                }
            }

            continue;
        }

        if (percent < threshold) continue;
        if (isIgnored(userId) || mutedByUs.has(userId) || isLocalMuted(userId)) continue;

        const loud = loudAt.get(userId) ?? [];
        loud.push(now);
        while (loud.length && now - loud[0] > LOUD_WINDOW_MS) loud.shift();
        loudAt.set(userId, loud);

        if (loud.length >= needed && now - (lastTriggerAt.get(userId) ?? 0) > TRIGGER_COOLDOWN_MS) {
            loudAt.set(userId, []);
            lastTriggerAt.set(userId, now);
            mute(userId, percent);
        }
    }

    if (dynamicUserVolume) updateDynamics(now);
}

function bindConnection(conn: VoiceConnection | null) {
    if (conn === boundConnection) return;

    boundConnection?.emitter?.off?.("stats", onStats);
    boundConnection = conn;
    conn?.emitter?.on?.("stats", onStats);
}

function poll() {
    try {
        const conn = getConnection();
        connection = conn;
        bindConnection(conn);

        const now = Date.now();
        const members = new Set(currentVoiceMembers());
        for (const userId of [...levels.keys()]) {
            if (!members.has(userId)) {
                levels.delete(userId);
                levelAt.delete(userId);
                loudAt.delete(userId);
                lastTriggerAt.delete(userId);
            } else if (now - (levelAt.get(userId) ?? 0) >= STALE_MS) {
                levels.set(userId, 0);
            }
        }

        updateDynamics(now);

        const seconds = settings.store.autoUnmute;
        if (seconds > 0) {
            for (const [userId, mutedAt] of [...mutedByUs]) {
                if (now - mutedAt >= seconds * 1000) unmute(userId, "auto");
            }
        }
    } catch (e) {
        logger.error("poll failed", e);
    }
}

function persistHeld() {
    void DataStore.set(HELD_KEY, Object.fromEntries(savedVolume)).catch(() => { });
}

async function saveIgnored() {
    try {
        await DataStore.set(IGNORED_KEY, [...ignored]);
    } catch (e) {
        logger.error("failed to save the ignore list", e);
    }
}

function toggleIgnored(userId: string) {
    if (!ignored.delete(userId)) ignored.add(userId);
    void saveIgnored();
}

function unmuteAll(mode: "manual" | "silent" = "manual") {
    for (const userId of [...mutedByUs.keys()]) unmute(userId, mode);
}

function MeterRow({ userId }: { userId: string; }) {
    const level = levels.get(userId) ?? 0;
    const { threshold } = settings.store;
    const loud = level >= threshold;
    const ignoredUser = isIgnored(userId);
    const muted = mutedByUs.has(userId);
    const turned = turnedDown.has(userId);

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
            <div style={{ width: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--header-primary)" }}>
                {displayName(userId)}
            </div>
            <div style={{ position: "relative", flex: 1, height: 10, borderRadius: 5, background: "var(--background-modifier-accent)", overflow: "hidden" }}>
                <div style={{ width: `${level}%`, height: "100%", background: loud ? "var(--status-danger)" : "var(--status-positive)" }} />
                <div style={{ position: "absolute", top: 0, left: `${threshold}%`, width: 2, height: "100%", background: "var(--text-muted)" }} />
            </div>
            <div style={{ width: 68, color: ignoredUser ? "var(--text-muted)" : "var(--header-secondary)", fontVariantNumeric: "tabular-nums" }}>
                {level}%
            </div>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => toggleIgnored(userId)}>
                {ignored.has(userId) ? "Allow" : "Ignore"}
            </Button>
            {muted && <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => unmute(userId, "manual")}>Unmute</Button>}
            {turned && <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => restoreVolume(userId, "manual")}>Restore</Button>}
        </div>
    );
}

function GuardPanel() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => {
        const id = setInterval(forceUpdate, 250);
        return () => clearInterval(id);
    }, []);

    const live = currentVoiceMembers();

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 16 }}>Live levels</div>
            <div style={{ color: "var(--header-secondary)", fontSize: 13, marginBottom: 8 }}>
                Everyone currently in the voice channel, with their loudest recent moments. The thin line on each bar is your threshold.
            </div>

            {live.length === 0
                ? <div style={{ color: "var(--text-muted)" }}>Join a voice channel to see levels.</div>
                : live.map(userId => <MeterRow key={userId} userId={userId} />)}

            {turnedDown.size > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Turned down by the guard</div>
                    {[...turnedDown].map(([userId, entry]) => (
                        <div key={userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                            <span style={{ color: "var(--status-warning)" }}>{displayName(userId)} - {entry.applied}% volume</span>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => restoreVolume(userId, "manual")}>Restore</Button>
                        </div>
                    ))}
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => restoreAll("manual")} style={{ marginTop: 4 }}>Restore all</Button>
                </div>
            )}

            {mutedByUs.size > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Muted by the guard</div>
                    {[...mutedByUs.keys()].map(userId => (
                        <div key={userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                            <span style={{ color: "var(--status-danger)" }}>{displayName(userId)}</span>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => unmute(userId, "manual")}>Unmute</Button>
                        </div>
                    ))}
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => unmuteAll("manual")} style={{ marginTop: 4 }}>Unmute all</Button>
                </div>
            )}

            {ignored.size > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Never muted</div>
                    {[...ignored].map(userId => (
                        <div key={userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                            <span>{displayName(userId)}</span>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => toggleIgnored(userId)}>Allow again</Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function MicSpamGuardIcon({ className }: { className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M10 3.2a2.8 2.8 0 0 1 2.8 2.8v5.2a2.8 2.8 0 0 1-5.6 0V6A2.8 2.8 0 0 1 10 3.2Z" fill="currentColor" />
            <path d="M5.4 11.2a4.6 4.6 0 0 0 9.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M10 15.9v2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M7.6 18.6h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="16.8" y="13.6" width="1.7" height="5" rx="0.85" fill="currentColor" />
            <rect x="19.3" y="10.9" width="1.7" height="7.7" rx="0.85" fill="currentColor" />
        </svg>
    );
}

function MicSpamGuardButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { enabled } = settings.use(MIC_GUARD_KEYS);

    return (
        <UserAreaButton
            icon={<MicSpamGuardIcon className={iconForeground} />}
            tooltipText={hideTooltips ? void 0 : "Mic Spam Guard"}
            aria-label="Mic Spam Guard"
            role="switch"
            aria-checked={enabled}
            redGlow={!enabled}
            plated={nameplate != null}
            onClick={() => openPluginModal(plugins.MicSpamGuard)}
            onContextMenu={event => {
                event.preventDefault();
                settings.store.enabled = !enabled;
                showToast(
                    `Mic Spam Guard ${settings.store.enabled ? "enabled" : "disabled"}.`,
                    Toasts.Type.MESSAGE
                );
            }}
        />
    );
}

export default definePlugin({
    name: "MicSpamGuard",
    description: "Locally mutes, or dynamically turns down, anyone who gets too loud or spams their mic in a voice channel.",
    authors: [{ name: "DavidHiFi", id: 1553713171938938891n }],
    tags: ["Voice", "Utility"],
    enabledByDefault: true,
    settings,
    settingsAboutComponent: GuardPanel,

    userAreaButton: {
        icon: MicSpamGuardIcon,
        render: MicSpamGuardButton
    },

    async start() {
        try {
            const saved = await DataStore.get(IGNORED_KEY);
            if (Array.isArray(saved)) {
                for (const userId of saved) if (typeof userId === "string") ignored.add(userId);
            }
        } catch (e) {
            logger.error("failed to load the ignore list", e);
        }

        try {
            const held = await DataStore.get(HELD_KEY);
            if (held && typeof held === "object") {
                for (const [userId, volume] of Object.entries(held as Record<string, number>)) {
                    if (typeof volume === "number") setLocalVolume(userId, volume);
                }
                await DataStore.del(HELD_KEY);
            }
        } catch (e) {
            logger.error("failed to restore held volumes", e);
        }

        intervalId = setInterval(poll, POLL_MS);
    },

    stop() {
        if (intervalId !== undefined) {
            clearInterval(intervalId);
            intervalId = undefined;
        }

        bindConnection(null);
        connection = null;
        loudAt.clear();
        lastTriggerAt.clear();

        for (const userId of [...mutedByUs.keys()]) unmute(userId, "silent");
        mutedByUs.clear();
        restoreAll("silent");
        turnedDown.clear();
        levels.clear();
        levelAt.clear();
    }
});
