/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Fork of Equicord's FullVCPFP (src/equicordplugins/fullVcPfp) that fills the
 * voice tile with the full-res avatar but keeps lightly rounded corners.
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import usrbg from "@plugins/usrbg";
import { fetchUserProfile } from "@utils/discord";
import { getUserAvatarUrl } from "@utils/misc";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { ChannelRTCStore, ChannelStore, IconUtils, SelectedChannelStore, UserProfileStore, UserStore, useStateFromStores, VoiceStateStore } from "@webpack/common";

import style from "./style.css?managed";

// VoiceVUMeters broadcasts audio activity through a window event, since
// Discord's speaking flag never fires for stream soundshare. This store turns
// the event into tile re-renders.
const audioActivityListeners = new Set<() => void>();
let audioActivityVersion = 0;
const audioActivityStore = {
    // useStateFromStores calls addReactChangeListener on every store it gets
    addReactChangeListener(listener: () => void) {
        audioActivityListeners.add(listener);
    },
    removeReactChangeListener(listener: () => void) {
        void audioActivityListeners.delete(listener);
    },
    subscribe(listener: () => void) {
        audioActivityListeners.add(listener);
        return () => void audioActivityListeners.delete(listener);
    },
    getVersion: () => audioActivityVersion
};
if (typeof window !== "undefined") {
    window.addEventListener("testcord-vu-audio-change", () => {
        audioActivityVersion++;
        for (const listener of audioActivityListeners) listener();
    });
}

function audioActiveNow(userId: string) {
    const api = (globalThis as { __testcordAudio?: { isActive(userId: string): boolean } }).__testcordAudio;
    return api ? api.isActive(userId) === true : false;
}

// The mask is a rounded rect in a 100x100 viewbox, so its rx scales the slider
// value with the painted picture; SVG clamps 52 to 50, which is the circle max.
function avatarMask(rx: number): string {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='${rx}' fill='#fff'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function parseHexColor(color: string): [number, number, number] | undefined {
    const match = HEX_COLOR.exec(color.trim());
    if (!match) return undefined;
    let hex = match[1];
    if (hex.length < 6) hex = [...hex.slice(0, 3)].map(c => c + c).join("");
    const value = parseInt(hex, 16);
    return [value >> 16 & 0xff, value >> 8 & 0xff, value & 0xff];
}

// The glow keeps the two-layer look from the theme's first version: one wide
// soft halo plus one tight edge shell, both from the user's color. The glow
// mix controls its own transparency, so an alpha channel in the hex is ignored.
function glowFilter(color: string): string | undefined {
    const rgb = parseHexColor(color);
    if (!rgb) return undefined;
    const [r, g, b] = rgb;
    return `drop-shadow(0 0 14px rgba(${r}, ${g}, ${b}, 0.4)) drop-shadow(0 0 3px rgba(${r}, ${g}, ${b}, 0.6))`;
}

const bannerFetches = new Set<string>();

function getProfileBannerUrl(userId: string): string | undefined {
    const banner = UserProfileStore.getUserProfile(userId)?.banner;
    if (!banner) {
        if (!bannerFetches.has(userId)) {
            bannerFetches.add(userId);
            fetchUserProfile(userId).catch(() => bannerFetches.delete(userId));
        }
        return undefined;
    }
    return IconUtils.getUserBannerURL({ id: userId, banner, canAnimate: false, size: 1024 }) ?? undefined;
}

// Participant types: STREAM 0, HIDDEN_STREAM 1, USER 2, ACTIVITY 3. Camera tiles
// are USER participants with a streamId, so streamId alone doesn't mean a stream.
const STREAM_PARTICIPANT_TYPES = new Set([0, 1]);

interface TileParticipant {
    type?: number;
    streamId?: unknown;
}

// The wrapper's children carry the participant somewhere below the tile root.
function findParticipant(children: unknown, depth = 0): TileParticipant | undefined {
    if (!children || typeof children !== "object" || depth > 6) return undefined;
    if (Array.isArray(children)) {
        for (const child of children) {
            const found = findParticipant(child, depth + 1);
            if (found) return found;
        }
        return undefined;
    }
    const { props } = children as { props?: { children?: unknown; participant?: TileParticipant; }; };
    if (!props) return undefined;
    return props.participant ?? findParticipant(props.children, depth + 1);
}

// The id of the stream selected in the call view, if any. Stream tiles paint
// live video only while their stream is this one; the rest of the time the
// tile shows a static preview picture.
type SelectedParticipant = { type?: unknown; id?: unknown } | null;
// A participant's own voice state can lag a join, so fall back to the call we are in
function getTileChannelId(userId: string): string | undefined {
    return VoiceStateStore.getVoiceStateForUser(userId)?.channelId ?? SelectedChannelStore.getVoiceChannelId() ?? undefined;
}

function getSelectedStreamId(channelId: string): string | null {
    const store = ChannelRTCStore as unknown as { getSelectedParticipant?: (id: string) => SelectedParticipant; };
    const selected = store.getSelectedParticipant?.(channelId) ?? null;
    if (!selected || selected.type !== "STREAM" || selected.id == null) return null;
    return String(selected.id);
}

// The stream key ends with the owner's id in Discord's raw format and in the
// guild:/call: forms, so the owner match covers both.
function isWatchedStream(channelId: string | null | undefined, participantUserId: string, participant: TileParticipant | undefined): boolean {
    if (!channelId || !participantUserId) return false;
    const selected = getSelectedStreamId(channelId);
    if (selected === null) return false;
    const sid = participant?.streamId != null ? String(participant.streamId) : "";
    return (sid !== "" && selected === sid) || selected.endsWith(`:${participantUserId}`) || selected === participantUserId;
}

const settings = definePluginSettings({
    avatarRadius: {
        type: OptionType.SLIDER,
        description: "Profile picture corner rounding. 0 is a flat square like FullVCPFP; 50 and higher is a full circle.",
        markers: makeRange(0, 52, 2),
        default: 5,
        stickToMarkers: true
    },
    cornerRadius: {
        type: OptionType.SLIDER,
        description: "Tile corner rounding in pixels. 0 is flat like FullVCPFP; 12 is a clean, visible round.",
        markers: makeRange(0, 52, 2),
        default: 12,
        stickToMarkers: true
    },
    zoom: {
        type: OptionType.SLIDER,
        description: "Avatar zoom in percent. 100 is the current size; lower values zoom the picture out inside the tile.",
        markers: makeRange(25, 100, 5),
        default: 100,
        stickToMarkers: true
    },
    hideTileBackground: {
        type: OptionType.BOOLEAN,
        description: "Turn off the background box behind profile pictures in call tiles and show only the picture.",
        default: false
    },
    hideUserBackgrounds: {
        type: OptionType.BOOLEAN,
        description: "Also hide backgrounds that users set themselves, like USRBG banners. The background switch above only turns off Discord's own background.",
        default: false
    },
    showUserBanners: {
        type: OptionType.BOOLEAN,
        description: "Fill the tile background with the user's profile banner when they have no USRBG background. Users without a banner keep the default look.",
        default: true
    },
    preferBanners: {
        type: OptionType.BOOLEAN,
        description: "Show profile banners even when the user has a USRBG background, painting over it in the same spot.",
        default: false
    },
    speakingIndicator: {
        type: OptionType.SELECT,
        description: "Where the green speaking glow shows on call tiles. Profile picture moves it from the tile border onto the picture edge; camera tiles keep the tile border.",
        options: [
            {
                label: "Box border",
                value: "box",
                default: true
            },
            {
                label: "Profile picture",
                value: "picture"
            }
        ]
    },
    enableGlow: {
        type: OptionType.BOOLEAN,
        description: "Turn the glow behind floating profile pictures on or off. Applies when the background switch is on.",
        default: true
    },
    glowColor: {
        type: OptionType.STRING,
        description: "Hex color code for the glow, for example #45475a. The glow mixes its own transparency levels.",
        placeholder: "#45475a",
        default: "#45475a",
        isValid(value: string) {
            return HEX_COLOR.test(value.trim()) ? true : "Enter a hex color like #45475a.";
        }
    }
});

export default definePlugin({
    name: "RoundedVCPFP",
    description: "Fork of FullVCPFP: fills the vc tile with the full-size avatar, with lightly rounded corners instead of square ones",
    tags: ["Appearance", "Voice"],
    authors: [{ name: "mochie", id: 1043599230247374869n }, { name: "DavidHiFi", id: 1553713171938938891n }],
    settings,
    managedStyle: style,
    patches: [
        {
            find: "\"data-selenium-video-tile\":",
            replacement: {
                // USRBG patches this component from the function head and wins the
                // patch-order race, so a head-anchored lookahead stops matching after
                // its Object.assign lands (notes/2026-10-08-voice-tile-avatars.md).
                // Anchor after the destructuring like the local userplugin copy;
                // Object.assign merges the style keys in any apply order. The hook
                // call before the assign re-renders the tile when the participant's
                // profile banner arrives, and stays unconditional so hook order holds.
                match: /(?<=let\{children:\i,className:\i,style:(\i),noBorder:\i=!1,participantUserId:\i,ref:\i\}=(\i);)/,
                replace: "$self.useTileBanner($2);Object.assign($1=$1||{},$self.getVoiceBackgroundStyles($2));",
            }
        },
    ],

    useTileBanner({ participantUserId }: { participantUserId?: string; }) {
        useStateFromStores([UserProfileStore], () => UserProfileStore.getUserProfile(participantUserId ?? "")?.banner, [participantUserId]);
        // getVoiceBackgroundStyles reads the speaking flag imperatively, so subscribe to re-render on changes
        useStateFromStores([ChannelRTCStore, VoiceStateStore, SelectedChannelStore], () => {
            const channelId = getTileChannelId(participantUserId ?? "");
            const speaking = channelId
                ? ChannelRTCStore.getSpeakingParticipants(channelId).some(p => p.user.id === participantUserId && p.speaking)
                : false;
            // A stream tile's glow depends on whether its stream is the one
            // selected in the call view, so the selection re-renders too.
            const selected = channelId ? getSelectedStreamId(channelId) : null;
            return `${speaking ? 1 : 0}:${selected ?? ""}`;
        }, [participantUserId]);
        // soundshare never sets Discord's speaking flag
        useStateFromStores([audioActivityStore], audioActivityStore.getVersion, []);
    },

    getVoiceBackgroundStyles({ className, participantUserId, children }: { className?: string; participantUserId?: string; children?: unknown; }) {
        if (!className?.includes("tile") || !participantUserId) return;

        const user = UserStore.getUser(participantUserId);
        if (!user) return;
        const legacyUser: typeof user & { getDefaultAvatarURL?: () => string; } = user;

        const channelId = getTileChannelId(participantUserId);
        const guildId = channelId ? ChannelStore.getChannel(channelId)?.guild_id : undefined;
        const participant = findParticipant(children);
        const participantType = participant?.type;
        const isStream = participantType !== undefined && STREAM_PARTICIPANT_TYPES.has(participantType);
        // Camera tiles keep Discord's own ring, there is no picture to glow
        const isCamera = !isStream && participant?.streamId != null;
        // Discord's flag is mic-only, soundshare comes from the VoiceVUMeters levels
        const isSpeaking = (channelId
            ? ChannelRTCStore.getSpeakingParticipants(channelId).some(p => p.user.id === participantUserId && p.speaking)
            : false) || audioActiveNow(participantUserId);
        // Only tiles showing the participant's picture glow. A live stream tile
        // paints video while its stream is the one selected in the call view and
        // stays unlit then; the rest of the time it shows a static preview
        // picture (Discord's or StreamEnhancer's custom one) and glows like any
        // other tile. Activity embeds never carry the participant's picture.
        const paintsLiveVideo = isStream && participantType === 0 && isWatchedStream(channelId, participantUserId, participant);
        const speakingGlow = isSpeaking && !paintsLiveVideo && (participantType === undefined || participantType === 0 || participantType === 1 || participantType === 2);

        // Fallback chain from the local FullVCPFP fix: getUserAvatarUrl's guild
        // branch can return undefined, which used to render blank tiles.
        const avatarUrl = getUserAvatarUrl(user, guildId, isSpeaking, 1024)
            || user.getAvatarURL?.(guildId, 1024, isSpeaking)
            || user.getAvatarURL?.(undefined, 1024, isSpeaking)
            || (typeof legacyUser.getDefaultAvatarURL === "function" ? legacyUser.getDefaultAvatarURL() : undefined)
            || "https://cdn.discordapp.com/embed/avatars/0.png";

        const hideBg = settings.store.hideTileBackground;
        const hideUserBg = settings.store.hideUserBackgrounds;
        let bannerUrl: string | undefined;
        if (settings.store.showUserBanners && !hideUserBg) {
            const usrbgWins = !settings.store.preferBanners
                && isPluginEnabled(usrbg.name)
                && usrbg.userHasBackground(participantUserId);
            if (!usrbgWins) bannerUrl = getProfileBannerUrl(participantUserId);
        }
        // The glow is independent of the background switch: it wraps the picture
        // whether the tile box is visible or not.
        const glow = settings.store.enableGlow ? glowFilter(settings.store.glowColor ?? "") : undefined;
        const ringPic = settings.store.speakingIndicator === "picture";
        // Picture mode adds the green glow to the filter, other tiles get a box from the stylesheet
        const filterParts: string[] = [];
        if (glow) filterParts.push(glow);
        if (ringPic && speakingGlow) filterParts.push("drop-shadow(0 0 2px var(--green-360, #23a55a)) drop-shadow(0 0 8px var(--green-360, #23a55a))");
        return {
            "--full-res-avatar": `url("${avatarUrl}")`,
            "--vc-pfp-radius": `${Math.round(settings.store.cornerRadius)}px`,
            "--vc-pfp-avatar-mask": avatarMask(Math.round(settings.store.avatarRadius)),
            "--vc-pfp-avatar-radius": `${Math.round(settings.store.avatarRadius)}%`,
            "--vc-pfp-zoom": `${Math.round(settings.store.zoom) / 100}`,
            // The background shorthand resets every background key in the merged
            // style object and erased USRBG's inline banner with Discord's own
            // paint (measured live, work/rvcpfp-usrbg-toggle-20261008). The color
            // longhand clears only the native box, and the image key is sent only
            // when user backgrounds are meant to hide, so USRBG's own keys
            // survive untouched otherwise.
            backgroundColor: hideBg ? "transparent" : "",
            ...(hideUserBg ? { backgroundImage: "none" } : {}),
            ...(bannerUrl ? {
                backgroundImage: `url("${bannerUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat"
            } : {}),
            "--vc-pfp-hide-bg": hideBg ? "1" : "",
            "--vc-pfp-speaking": speakingGlow ? "1" : "",
            "--vc-pfp-ring-pic": ringPic ? "1" : "",
            // Stream tiles are not voice: their video never carries the
            // speaking ring, the stylesheet keys on this marker.
            "--vc-pfp-stream": isStream ? "1" : "",
            // camera tiles keep the native tile border in picture mode
            "--vc-pfp-camera": isCamera ? "1" : "",
            // Marks this plugin version for theme handoff: themes drop their own
            // fallback glow when the slot is present. The filter string carries the
            // configured color; themes and any other stylesheet consume it.
            "--vc-pfp-glow-slot": "1",
            "--vc-pfp-glow-filter": filterParts.length ? filterParts.join(" ") : ""
        };
    },
});
