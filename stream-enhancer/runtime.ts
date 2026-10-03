/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByCodeLazy, findByPropsLazy, findStoreLazy } from "@webpack";

import type {
    ApplicationStreamingStoreLike,
    ChannelRtcActionsLike,
    ChannelRTCStoreLike,
    PopoutActionsLike,
    PopoutWindowStoreLike,
    StreamDescriptor,
    StreamUiConstantsLike,
    WatchStreamOptions
} from "./types";

export const applicationStreamingStore = findStoreLazy("ApplicationStreamingStore") as ApplicationStreamingStoreLike | undefined;
export const channelRtcStore = findStoreLazy("ChannelRTCStore") as ChannelRTCStoreLike | undefined;
export const watchStream = findByCodeLazy('type:"STREAM_WATCH"') as ((stream: StreamDescriptor, options?: WatchStreamOptions) => void) | undefined;
export const popoutActions = findByPropsLazy("openChannelCallPopout", "openCallTilePopout") as PopoutActionsLike | undefined;
export const channelRtcActions = findByPropsLazy("selectParticipant", "updateLayout", "popoutParticipant") as ChannelRtcActionsLike | undefined;
export const streamUiConstants = findByPropsLazy("BRT", "DUB", "MLl") as StreamUiConstantsLike | undefined;
export const popoutWindowStore = findStoreLazy("PopoutWindowStore") as PopoutWindowStoreLike | undefined;
