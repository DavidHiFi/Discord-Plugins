/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

// The chosen image lives in DataStore, not plugin settings: settings are re-normalised on every
// read, and a multi-megabyte data URL there would be re-processed constantly.
const DATASTORE_KEY = "StreamEnhancer_customPreviewImage";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

let localObjectUrl: string | null = null;
let loadInFlight: Promise<string | null> | null = null;
let onLocalPreviewChanged: (() => void) | null = null;

const replaceObjectUrl = (next: string | null) => {
    if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
    localObjectUrl = next;
};

export const getLocalPreviewUrl = () => localObjectUrl;

// The cover refresh re-reads the source whenever this changes, so a load that lands
// after startup still reaches the cover.
export const setLocalPreviewChangeListener = (listener: () => void) => {
    onLocalPreviewChanged = listener;
};

export const loadLocalPreview = async () => {
    const blob = await DataStore.get<Blob>(DATASTORE_KEY);
    replaceObjectUrl(blob ? URL.createObjectURL(blob) : null);
    onLocalPreviewChanged?.();
    return localObjectUrl;
};

// Single-flight load for callers that need the file now and do not have it yet.
export const requestLocalPreview = () => {
    if (loadInFlight) return;
    loadInFlight = loadLocalPreview()
        .catch(() => null)
        .finally(() => { loadInFlight = null; });
};

export const saveLocalPreview = async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is larger than 25 MB.");

    await DataStore.set(DATASTORE_KEY, file);
    return loadLocalPreview();
};

export const clearLocalPreview = async () => {
    await DataStore.del(DATASTORE_KEY);
    replaceObjectUrl(null);
};
