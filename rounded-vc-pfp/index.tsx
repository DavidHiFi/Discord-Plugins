/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Fork of Equicord's FullVCPFP (src/equicordplugins/fullVcPfp) that fills the
 * voice tile with the full-res avatar but keeps lightly rounded corners.
 */

import { definePluginSettings } from "@api/Settings";
import { getUserAvatarUrl } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelRTCStore, ChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

import style from "./style.css?managed";

const settings = definePluginSettings({
    avatarRadius: {
        type: OptionType.SLIDER,
        description: "Profile picture corner rounding. 0 is a flat square like FullVCPFP; 50 and higher is a full circle.",
        markers: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52],
        default: 5,
        stickToMarkers: false
    },
    cornerRadius: {
        type: OptionType.SLIDER,
        description: "Tile corner rounding in pixels. 0 is flat like FullVCPFP; 12 is a clean, visible round.",
        markers: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52],
        default: 12,
        stickToMarkers: false
    },
    zoom: {
        type: OptionType.SLIDER,
        description: "Avatar zoom in percent. 100 is the current size; lower values zoom the picture out inside the tile.",
        markers: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
        default: 100,
        stickToMarkers: false
    },
    hideTileBackground: {
        type: OptionType.BOOLEAN,
        description: "Turn off the background box behind profile pictures in call tiles and show only the picture.",
        default: false
    }
});

// The mask is a rounded rect in a 100x100 viewbox, so its rx scales the slider
// value with the painted picture; SVG clamps 52 to 50, which is the circle max.
function avatarMask(rx: number): string {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='${rx}' fill='#fff'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export default definePlugin({
    name: "RoundedVCPFP",
    description: "Fork of FullVCPFP: fills the vc tile with the full-size avatar, with lightly rounded corners instead of square ones",
    tags: ["Appearance", "Voice"],
    authors: [{ name: "DavidHiFi", id: 1553713171938938891n }],
    settings,
    managedStyle: style,
    enabledByDefault: true,
    patches: [
        {
            find: "\"data-selenium-video-tile\":",
            replacement: {
                match: /(?<=function\((\i),\i\)\{)/,
                replace: "Object.assign($1.style=$1.style||{},$self.getVoiceBackgroundStyles($1));",
            }
        },
    ],

    getVoiceBackgroundStyles({ participantUserId }: { className?: string; participantUserId?: string; }) {
        if (!participantUserId) return;

        const user = UserStore.getUser(participantUserId);
        if (!user) return;

        const channelId = VoiceStateStore.getVoiceStateForUser(participantUserId)?.channelId;
        const guildId = channelId ? ChannelStore.getChannel(channelId)?.guild_id : undefined;
        const isSpeaking = channelId
            ? ChannelRTCStore.getSpeakingParticipants(channelId).some(p => p.user.id === participantUserId && p.speaking)
            : false;

        // Fallback chain from the local FullVCPFP fix: getUserAvatarUrl's guild
        // branch can return undefined, which used to render blank tiles.
        const avatarUrl = getUserAvatarUrl(user, guildId, isSpeaking, 1024)
            || user.getAvatarURL?.(guildId, 1024, isSpeaking)
            || user.getAvatarURL?.(undefined, 1024, isSpeaking)
            || user.getDefaultAvatarURL?.()
            || "https://cdn.discordapp.com/embed/avatars/0.png";

        const hideBg = settings.store.hideTileBackground;
        return {
            "--full-res-avatar": `url("${avatarUrl}")`,
            "--vc-pfp-radius": `${settings.store.cornerRadius}px`,
            "--vc-pfp-avatar-mask": avatarMask(Math.round(settings.store.avatarRadius)),
            "--vc-pfp-avatar-radius": `${Math.round(settings.store.avatarRadius)}%`,
            "--vc-pfp-zoom": `${settings.store.zoom / 100}`,
            // Empty string clears the inline background so the toggle off restores
            // Discord's paint; "none" hides the tile's own box when the switch is on.
            background: hideBg ? "none" : "",
            "--vc-pfp-hide-bg": hideBg ? "1" : ""
        };
    },
});
