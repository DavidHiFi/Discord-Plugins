/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

/* ===========================
 * Discord voice state (Self explanitory)
 * =========================== */

const VoiceStateStore = findByPropsLazy("getSelfMute", "getSelfDeaf");
const VoiceStateActions = findByPropsLazy("setSelfMute", "setSelfDeaf");

/* ===========================
 * Plugin settings (They don't really exist tbh)
 * =========================== */

const settings = definePluginSettings({
    fakeEnabled: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Fake mute/deafen",
        hidden: true
    }
});

/* ===========================
 * Icon (SVG thing that looks cool)
 * =========================== */

function FakeAudioIcon({ className }: { className?: string }) {
    const { fakeEnabled } = settings.use(["fakeEnabled"]);
    const isActive = fakeEnabled;

    const redLinePath =
        "M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z";
    const maskBlackPath =
        "M23.27 4.73 19.27 .73 -.27 20.27 3.73 24.27Z";

    return (
        <svg
            className={className}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isActive ? "currentColor" : "var(--status-danger)"}
        >
            {!isActive && (
                <>
                    <mask id="fakeAudioMask">
                        <rect fill="white" width="24" height="24" />
                        <path fill="black" d={maskBlackPath} />
                    </mask>
                    <path fill="var(--status-danger)" d={redLinePath} />
                </>
            )}

            <g mask={!isActive ? "url(#fakeAudioMask)" : void 0}>
                <rect x="1" y="10" width="2" height="4" rx="1" />
                <rect x="5" y="6" width="2" height="12" rx="1" />
                <rect x="9" y="3" width="2" height="18" rx="1" />
                <rect x="13" y="8.5" width="2" height="7" rx="1" />
                <rect x="17" y="5.5" width="2" height="13" rx="1" />
                <rect x="21" y="10" width="2" height="4" rx="1" />
            </g>
        </svg>
    );
}

/* ===========================
 * Button (You press it I think)
 * =========================== */

function FakeAudioButton({
    iconForeground,
    hideTooltips,
    nameplate
}: UserAreaRenderProps) {
    const { fakeEnabled } = settings.use(["fakeEnabled"]);
    const isActive = fakeEnabled;

    const toggle = () => {
        const newVal = !isActive;
        settings.store.fakeEnabled = newVal;

        // Ensure real voice state stays unmuted / undeafened
        if (newVal) {
            if (VoiceStateStore.getSelfMute()) {
                VoiceStateActions.setSelfMute(false);
            }
            if (VoiceStateStore.getSelfDeaf()) {
                VoiceStateActions.setSelfDeaf(false);
            }
        }
    };

    return (
        <UserAreaButton
            tooltipText={
                hideTooltips
                    ? void 0
                    : isActive
                        ? "Disable Fake Mute/Deafen"
                        : "Enable Fake Mute/Deafen"
            }
            icon={<FakeAudioIcon className={iconForeground} />}
            role="switch"
            aria-checked={isActive}
            redGlow={!isActive}
            plated={nameplate != null}
            onClick={toggle}
        />
    );
}

/* ===========================
 * Plugin (Kind of a big deal or something like that)
 * =========================== */

export default definePlugin({
    name: "Fake Mute/Deafen",
    description: "Fake being muted/deafened while still hearing and speaking.",
    authors: [{ name: "Zak", id: 223472303000911873n }],
    tags: ["Voice", "Shortcuts"],
    dependencies: ["UserAreaAPI"],

    settings,

    userAreaButton: {
        icon: FakeAudioIcon,
        render: FakeAudioButton
    },

    patches: [
        {
            find: "e.setSelfMute(n)",
            replacement: {
                match: /e\.setSelfMute\(n\)/g,
                replace: "e.setSelfMute($self.shouldFakeMute(n))"
            }
        },
        {
            find: "e.setSelfDeaf(t.deaf)",
            replacement: {
                match: /e\.setSelfDeaf\(t\.deaf\)/g,
                replace: "e.setSelfDeaf($self.shouldFakeDeaf(t.deaf))"
            }
        }
    ],

    shouldFakeMute(original: boolean) {
        return settings.store.fakeEnabled ? false : original;
    },

    shouldFakeDeaf(original: boolean) {
        return settings.store.fakeEnabled ? false : original;
    }
});