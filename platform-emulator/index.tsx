/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * PlatformEmulator fork (DavidHiFi): keeps the original plugin intact and adds
 * an optional self-view toggle plus a voice channel indicator, so you can see
 * your own spoofed platform exactly the way everyone else sees it.
 * Original authors: SirPhantom89 (dx, now dxrx99) and x2b. Fork: DavidHiFi.
 */

import { sendBotMessage } from "@api/Commands/commandHelpers";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Notice } from "@components/Notice";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { Session } from "@vencord/discord-types";
import { filters, findByProps, mapMangledModuleLazy } from "@webpack";
import { AuthenticationStore, SessionsStore, Tooltip, useStateFromStores } from "@webpack/common";

import style from "./style.css?managed";

const { useStatusFillColor } = mapMangledModuleLazy([".5625*", "translate"], {
    useStatusFillColor: filters.byCode(".hex")
});

const infos: Record<string, { os: string; browser: string; }> = {
    windows: { os: "Windows", browser: "Discord Client" },
    linux: { os: "Linux", browser: "Discord Client" },
    macos: { os: "Mac OS X", browser: "Discord Client" },
    android: { os: "Android", browser: "Discord Android" },
    mobile: { os: "iOS", browser: "Discord iOS" },
    xbox: { os: "Xbox", browser: "Discord Embedded" },
    playstation: { os: "PlayStation", browser: "Discord Embedded" },
    vr: { os: "VR", browser: "Discord VR" },
    web: { os: "Web", browser: "Discord Web" },
};

// Desktop OS profiles used for aggressive (deep) IDENTIFY spoofing.
const desktopProfiles: Record<string, { os: string; osVersion: string; userAgent: string; }> = {
    windows: {
        os: "Windows",
        osVersion: "10.0.22631",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    macos: {
        os: "Mac OS X",
        osVersion: "13.6.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    linux: {
        os: "Linux",
        osVersion: "6.6.0",
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
};

// Maps the selected platform onto a coherent desktop profile for deep spoofing.
// Non-desktop platforms fall back to Linux since desktop UA strings only make
// sense for desktop operating systems.
function resolveDesktopProfile(platform: string) {
    switch (platform) {
        case "windows":
            return desktopProfiles.windows;
        case "macos":
            return desktopProfiles.macos;
        case "linux":
            return desktopProfiles.linux;
        default:
            return desktopProfiles.linux;
    }
}

const settings = definePluginSettings({
    plateforme: {
        type: OptionType.SELECT,
        description: "The platform to spoof",
        restartNeeded: true,
        default: "windows",
        options: [
            { label: "Windows", value: "windows", default: true },
            { label: "Linux", value: "linux" },
            { label: "macOS", value: "macos" },
            { label: "Android", value: "android" },
            { label: "iOS (iPhone)", value: "mobile" },
            { label: "Xbox", value: "xbox" },
            { label: "PlayStation", value: "playstation" },
            { label: "VR Headset", value: "vr" },
            { label: "Web", value: "web" }
        ],
    },
    showOwnSpoofed: {
        type: OptionType.BOOLEAN,
        description: "Show the spoofed icon on your own profile, messages, member list, and voice channels. See your own platform the way everyone else does.",
        restartNeeded: false,
        default: false,
    },
    aggressiveSpoofing: {
        type: OptionType.BOOLEAN,
        description: "Enable aggressive OS spoofing (injects extra IDENTIFY / client metadata). Choose the depth with the level selector below.",
        restartNeeded: true,
        default: false
    },
    aggressiveLevel: {
        type: OptionType.SELECT,
        description: "How much extra metadata to spoof when aggressive spoofing is enabled",
        restartNeeded: true,
        default: "medium",
        options: [
            { label: "Low (device + locale)", value: "low" },
            { label: "Medium (+ versions + release channel)", value: "medium", default: true },
            { label: "High (+ user agent + client build)", value: "high" }
        ]
    }
});

const SELF_KEYS = ["showOwnSpoofed", "plateforme"] as const;

function Icon(path: string, opts?: { viewBox?: string; width?: number; height?: number; }) {
    return ({ color, tooltip, small, style }: { color: string; tooltip: string; small: boolean; style?: React.CSSProperties; }) => (
        <Tooltip text={tooltip}>
            {tooltipProps => (
                <svg
                    {...tooltipProps}
                    style={style}
                    height={(opts?.height ?? 20) - (small ? 4 : 0)}
                    width={(opts?.width ?? 20) - (small ? 4 : 0)}
                    viewBox={opts?.viewBox ?? "0 0 24 24"}
                    fill={color}
                >
                    <path d={path} />
                </svg>
            )}
        </Tooltip>
    );
}

const Icons: Record<string, ReturnType<typeof Icon>> = {
    desktop: Icon("M4 2.5c-1.103 0-2 .897-2 2v11c0 1.104.897 2 2 2h7v2H7v2h10v-2h-4v-2h7c1.103 0 2-.896 2-2v-11c0-1.103-.897-2-2-2H4Zm16 2v9H4v-9h16Z"),
    web: Icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z"),
    mobile: Icon("M 187 0 L 813 0 C 916.277 0 1000 83.723 1000 187 L 1000 1313 C 1000 1416.277 916.277 1500 813 1500 L 187 1500 C 83.723 1500 0 1416.277 0 1313 L 0 187 C 0 83.723 83.723 0 187 0 Z M 125 1000 L 875 1000 L 875 250 L 125 250 Z M 500 1125 C 430.964 1125 375 1180.964 375 1250 C 375 1319.036 430.964 1375 500 1375 C 569.036 1375 625 1319.036 625 1250 C 625 1180.964 569.036 1125 500 1125 Z", { viewBox: "0 0 1000 1500", height: 17, width: 17 }),
    embedded: Icon("M3.06 20.4q-1.53 0-2.37-1.065T.06 16.74l1.26-9q.27-1.8 1.605-2.97T6.06 3.6h11.88q1.8 0 3.135 1.17t1.605 2.97l1.26 9q.21 1.53-.63 2.595T20.94 20.4q-.63 0-1.17-.225T18.78 19.5l-2.7-2.7H7.92l-2.7 2.7q-.45.45-.99.675t-1.17.225Zm14.94-7.2q.51 0 .855-.345T19.2 12q0-.51-.345-.855T18 10.8q-.51 0-.855.345T16.8 12q0 .51.345 .855T18 13.2Zm-2.4-3.6q.51 0 .855-.345T16.8 8.4q0-.51-.345-.855T15.6 7.2q-.51 0-.855.345T14.4 8.4q0 .51.345 .855T15.6 9.6ZM6.9 13.2h1.8v-2.1h2.1v-1.8h-2.1v-2.1h-1.8v2.1h-2.1v1.8h2.1v2.1Z", { viewBox: "0 0 24 24", height: 20, width: 20 }),
    vr: Icon("M8.46 8.64a1 1 0 0 1 1 1c0 .44-.3.8-.72.92l-.11.07c-.08.06-.2.19-.2.41a.99.99 0 0 1-.98.86h-.06a1 1 0 0 1-.94-1.05l.02-.32c.05-1.06.92-1.9 1.99-1.9ZM15.55 5a5.5 5.5 0 0 1 5.15 3.67h.3a2 2 0 0 1 2 2v3.18a2 2 0 0 1-2 1.99h-.2A4.54 4.54 0 0 1 16.55 19a4.45 4.45 0 0 1-3.6-1.83 1.2 1.2 0 0 0-1.9 0 4.44 4.44 0 0 1-3.9 1.82 4.54 4.54 0 0 1-3.94-3.15H3a2 2 0 0 1-2-2v-3.18c0-1.1.9-1.99 2-1.99h.3A5.5 5.5 0 0 1 8.46 5h7.09Zm-7.1 2C6.6 7 5.06 8.5 4.97 10.41l-.02.66v3.18c0 1.43 1.05 2.66 2.34 2.74.85.06 1.63-.32 2.14-1.01a3.2 3.2 0 0 1 2.57-1.3c1 0 1.97.48 2.57 1.3.5.69 1.3 1.08 2.14 1.01 1.3-.08 2.34-1.31 2.34-2.74l-.02-3.84a3.54 3.54 0 0 0-3.49-3.43H8.45Z", { viewBox: "0 4 24 16", height: 20, width: 20 }),
};

const platformMap: Record<string, string> = {
    embedded: "Embedded (Console or Game)",
    vr: "VR"
};

function PlatformIcon({ platform, status, small }: { platform: string; status: string; small: boolean; }) {
    const tooltip = platformMap[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
    const IconComponent = Icons[platform] ?? Icons.desktop;
    return <IconComponent color={useStatusFillColor(status)} tooltip={tooltip} small={small} />;
}

let lastPlatform = "";
let lastStatus = "";
let lastValue: Record<string, string> | null = null;

function selfSpoofedStatus(): Record<string, string> | null {
    if (!settings.store.showOwnSpoofed) return null;
    const platform = settings.store.plateforme ?? "vr";
    const status = SessionsStore.getSession()?.status ?? "online";
    if (platform === lastPlatform && status === lastStatus) return lastValue;
    lastPlatform = platform;
    lastStatus = status;
    lastValue = { [platform]: status };
    return lastValue;
}

const VoiceIndicator = ErrorBoundary.wrap(({ userId }: { userId: string; }) => {
    settings.use(SELF_KEYS);
    const isSelf = userId === AuthenticationStore.getId();
    const status = useStateFromStores([SessionsStore], selfSpoofedStatus);
    if (!isSelf || !status) return null;
    return (
        <span className="vc-platform-indicator" style={{ display: "inline-flex", alignItems: "center", gap: 2, marginLeft: 4, verticalAlign: "middle" }}>
            {Object.entries(status).map(([platform, platformStatus]) => (
                <PlatformIcon key={platform} platform={platform} status={platformStatus} small />
            ))}
        </span>
    );
}, { noop: true });

let originalGetSessions: (() => Record<string, Session>) | undefined;

export default definePlugin({
    name: "PlatformEmulator",
    description: "Spoof your Discord platform so others see a different device — and with the self-view toggle, you see it too.",
    tags: ["Privacy", "Utility"],
    authors: [
        TestcordDevs.dxrx99,
        TestcordDevs.x2b,
        TestcordDevs.DavidHiFi,
    ],
    settings,
    managedStyle: style,
    settingsAboutComponent: () => (
        <Notice.Warning>
            Aggressive spoofing modifies IDENTIFY and client metadata. Risk is non-zero and may get you warned or banned.
        </Notice.Warning>
    ),
    patches: [
        {
            find: "_doIdentify(){",
            replacement: [
                {
                    match: /window._ws=null,null!=\i/,
                    replace: "false"
                },
                {
                    match: /(?<="GatewaySocket"\)\}\),properties:)(\i)/,
                    replace: "{...$1,...$self.getData()}"
                },
                {
                    match: /(\[IDENTIFY\].*?let.{0,5}=\{)/,
                    replace: "$1...$self.getIdentifyOverrides(),"
                },
            ]
        },
        {
            find: "#{intl::GUEST_NAME_SUFFIX})]",
            replacement: {
                match: /#{intl::GUEST_NAME_SUFFIX}\)\]\}\):""(?=.{0,300}?userId:(\i\.\i))/,
                replace: "$&,$self.renderVoiceIndicator($1)"
            }
        },
        {
            // Call tile name plate (main voice view). Binds the tile overlay's
            // participant id to a stable name, then appends the indicator to
            // the name plate's child array right after the display name, so
            // it sits just before the activity pill on hover.
            find: ',"title-text"))',
            replacement: [
                {
                    match: /participantUserId:(\i),channel:(\i),platform:(\i),/,
                    // Bind the same property to a second local (vcPeSelfId);
                    // rebinding $1's own identifier is a duplicate-binding
                    // SyntaxError and the whole module fails to compile.
                    replace: "participantUserId:$1,participantUserId:vcPeSelfId,channel:$2,platform:$3,"
                },
                {
                    match: /(\i)\.push\(\(0,\i\.jsx\)\("span",\{className:\i\(\)\(\i\.\i,\i\),children:\i\},"title-text"\)\)/,
                    replace: "$&,$self.tileIndicatorPush($1,vcPeSelfId)"
                }
            ]
        }
    ],
    getData() {
        const selected = settings.store.plateforme ?? "windows";
        const info = infos[selected] ?? infos.windows;

        return {
            os: info.os,
            browser: info.browser
        };
    },
    getIdentifyOverrides() {
        // No-op unless aggressive spoofing is explicitly enabled.
        if (!settings.store.aggressiveSpoofing) return {};

        const platform = settings.store.plateforme ?? "windows";
        const level = settings.store.aggressiveLevel ?? "medium";
        const profile = resolveDesktopProfile(platform);

        // Low: minimal extra fields.
        const overrides: Record<string, any> = {
            properties: {
                os: profile.os,
                browser: "Chrome",
                device: "",
                system_locale: "en-US"
            },
            device: "",
            system_locale: "en-US"
        };

        if (level === "medium" || level === "high") {
            overrides.os_version = profile.osVersion;
            overrides.browser_version = "120.0.0.0";
            overrides.release_channel = "stable";
            overrides.referrer = "";
            overrides.referring_domain = "";
        }

        if (level === "high") {
            overrides.browser = "Chrome";
            overrides.browser_user_agent = profile.userAgent;
            overrides.client_version = "1.0.9000";
            overrides.client_build_number = 999999;
        }

        return overrides;
    },
    renderVoiceIndicator(userId: string) {
        return <VoiceIndicator userId={userId} />;
    },
    tileIndicatorPush(arr: unknown[], userId: string) {
        // Subscribe the tile overlay to self-view setting changes, then add
        // the indicator element only for the local user when enabled.
        settings.use(SELF_KEYS);
        if (userId !== AuthenticationStore.getId()) return;
        arr.push(<VoiceIndicator userId={userId} />);
    },
    start() {
        // Serve the spoofed client everywhere sessions are read for the own
        // user (profile, messages, member list). Live-gated so the toggle
        // works without a restart; stop() puts the original method back.
        const original = SessionsStore.getSessions.bind(SessionsStore);
        originalGetSessions = original;
        SessionsStore.getSessions = () => {
            const sessions = original();
            if (settings.store.showOwnSpoofed) {
                const spoofed = settings.store.plateforme ?? "vr";
                for (const session of Object.values(sessions)) {
                    if (session.clientInfo) session.clientInfo.client = spoofed;
                }
            }
            return sessions;
        };
    },
    stop() {
        if (originalGetSessions) {
            SessionsStore.getSessions = originalGetSessions;
            originalGetSessions = undefined;
        }
    },
    commands: [
        {
            name: "verify-os",
            description: "Verify the spoofed platform by triggering a reconnect and displaying the current spoof.",
            execute: (_args, ctx) => {
                const platform = settings.store.plateforme ?? "windows";
                const info = infos[platform] ?? infos.windows;
                const aggressive = settings.store.aggressiveSpoofing
                    ? ` | Aggressive: ${settings.store.aggressiveLevel ?? "medium"}`
                    : "";
                const selfView = settings.store.showOwnSpoofed ? " | Self-view on" : " | Self-view off";
                sendBotMessage(ctx.channel.id, {
                    content: `Current spoofed platform: ${info.os} (${info.browser})${aggressive}${selfView}. Triggering reconnect to send IDENTIFY payload.`,
                    author: {
                        username: "PlatformEmulator"
                    }
                });
                // Trigger reconnect
                const gateway = findByProps("connect", "destroy");
                if (gateway) {
                    gateway.destroy();
                    setTimeout(() => gateway.connect(), 1000);
                }
            }
        }
    ]
});
