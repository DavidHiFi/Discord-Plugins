/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { filters, waitFor } from "@webpack";

import { getMicrophoneRuntimeConfig } from "./settings";

type ManagedMicrophoneStream = {
    cleanup: () => void;
    sync: () => void;
};

const managedMicrophoneStreams = new WeakMap<MediaStream, ManagedMicrophoneStream>();
const activeManagedMicrophoneStreams = new Set<ManagedMicrophoneStream>();
type MediaDevicesLike = {
    getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
};
type MicrophoneManagerLike = {
    prototype?: {
        acquire?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
        release?: (stream: MediaStream) => void;
    };
};
let restoreMicrophoneInterceptor: (() => void) | null = null;
let microphoneInterceptorVersion = 0;

const microphoneManagerFilter = filters.byCode("navigator.mediaDevices.getUserMedia", "getTracks().forEach");

type AudioContextConstructor = typeof AudioContext;

const getAudioContextConstructor = (): AudioContextConstructor | null => {
    if (typeof window === "undefined") return null;

    const candidate = window.AudioContext;
    return typeof candidate === "function" ? candidate : null;
};

const getMediaDevices = (): MediaDevicesLike | null => {
    if (typeof navigator === "undefined" || navigator.mediaDevices == null) return null;
    return navigator.mediaDevices as MediaDevicesLike;
};

const stopStream = (stream: MediaStream) => {
    for (const track of stream.getTracks()) {
        track.onended = () => { };
        track.stop();
    }
};

const shouldUseMicrophoneTweaks = (constraints: MediaStreamConstraints) => {
    return getMicrophoneRuntimeConfig().tweaksEnabled
        && constraints.audio !== false
        && (constraints.video == null || constraints.video === false);
};

const cloneAudioConstraints = (audio: MediaTrackConstraints | boolean | undefined) => {
    return typeof audio === "object" ? { ...audio } : {};
};

export const prepareMicrophoneConstraints = (constraints: MediaStreamConstraints) => {
    if (!shouldUseMicrophoneTweaks(constraints)) return constraints;

    const microphoneConfig = getMicrophoneRuntimeConfig();
    const audio = cloneAudioConstraints(constraints.audio);
    const inputChannelCount = microphoneConfig.routing === "stereo" ? microphoneConfig.channelCount : 2;

    return {
        ...constraints,
        audio: {
            ...audio,
            autoGainControl: microphoneConfig.autoGainControl,
            channelCount: inputChannelCount,
            echoCancellation: microphoneConfig.echoCancellation,
            latency: microphoneConfig.ptimeSeconds,
            noiseSuppression: microphoneConfig.noiseSuppression,
            sampleRate: microphoneConfig.sampleRate
        }
    };
};

const connectDualMono = (
    splitter: ChannelSplitterNode,
    merger: ChannelMergerNode,
    sourceChannel: number,
    leftGain: GainNode,
    rightGain: GainNode
) => {
    splitter.connect(leftGain, sourceChannel, 0);
    splitter.connect(rightGain, sourceChannel, 0);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
};

const connectMonoMix = (
    splitter: ChannelSplitterNode,
    merger: ChannelMergerNode,
    leftGain: GainNode,
    rightGain: GainNode
) => {
    leftGain.gain.value = 0.5;
    rightGain.gain.value = 0.5;

    splitter.connect(leftGain, 0, 0);
    splitter.connect(rightGain, 1, 0);
    leftGain.connect(merger, 0, 0);
    leftGain.connect(merger, 0, 1);
    rightGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
};

const createShittyMicCurve = () => {
    const curve = new Float32Array(256);

    for (let index = 0; index < curve.length; index++) {
        const sample = index / (curve.length - 1) * 2 - 1;
        curve[index] = Math.max(-0.015, Math.min(0.015, sample * 12));
    }

    return curve;
};

const createShittyMicProcessor = (context: AudioContext) => {
    const processor = context.createScriptProcessor(2048, 2, 2);
    const heldSamples = [0, 0];
    const pitchBuffer = new Float32Array(8192);
    const pitchMask = pitchBuffer.length - 1;
    let holdCounter = 0;
    let latch = 0;
    let flutterPhase = 0;
    let pitchReadIndex = pitchBuffer.length / 2;
    let pitchWriteIndex = 0;

    processor.onaudioprocess = event => {
        const { inputBuffer, outputBuffer } = event;
        const channelCount = Math.min(outputBuffer.numberOfChannels, heldSamples.length);
        const leftInput = inputBuffer.getChannelData(0);
        const rightInput = inputBuffer.numberOfChannels > 1
            ? inputBuffer.getChannelData(1)
            : leftInput;

        for (let channel = 0; channel < channelCount; channel++) {
            const output = outputBuffer.getChannelData(channel);

            for (let index = 0; index < output.length; index++) {
                const runtimeConfig = getMicrophoneRuntimeConfig();
                const monoSample = (leftInput[index] + rightInput[index]) * 0.5;
                const pitchShiftMix = runtimeConfig.shittyPitchShiftPercent / 100;

                pitchBuffer[pitchWriteIndex] = monoSample;
                let pitchedSample = monoSample;

                if (pitchShiftMix > 0) {
                    const readBaseIndex = Math.floor(pitchReadIndex) & pitchMask;
                    const readNextIndex = (readBaseIndex + 1) & pitchMask;
                    const readMix = pitchReadIndex - Math.floor(pitchReadIndex);
                    pitchedSample = pitchBuffer[readBaseIndex] * (1 - readMix) + pitchBuffer[readNextIndex] * readMix;
                    pitchReadIndex = (pitchReadIndex + 1 + pitchShiftMix * 1.4) % pitchBuffer.length;
                    const pitchDistance = (pitchWriteIndex - Math.floor(pitchReadIndex) + pitchBuffer.length) & pitchMask;
                    if (pitchDistance < 256) pitchReadIndex = (pitchWriteIndex - 1024 + pitchBuffer.length) & pitchMask;
                } else {
                    pitchReadIndex = (pitchWriteIndex - 1024 + pitchBuffer.length) & pitchMask;
                }

                pitchWriteIndex = (pitchWriteIndex + 1) & pitchMask;

                if (!runtimeConfig.degradeAudio) {
                    output[index] = pitchShiftMix > 0
                        ? Math.max(-1, Math.min(1, pitchedSample * (1.1 + pitchShiftMix * 0.9)))
                        : channel === 0
                            ? leftInput[index]
                            : rightInput[index];
                    continue;
                }

                if (holdCounter <= 0) {
                    const shittyVoiceBoost = runtimeConfig.shittyVoiceBoostPercent > 0;
                    const boostMultiplier = 1 + runtimeConfig.shittyVoiceBoostPercent / 20;
                    const dropoutMix = runtimeConfig.shittyDropoutPercent / 100;
                    const staticMix = runtimeConfig.shittyStaticPercent / 100;
                    const level = Math.min(1, Math.abs(monoSample) * (shittyVoiceBoost ? 45 * boostMultiplier : 45));
                    const gateThreshold = shittyVoiceBoost
                        ? (runtimeConfig.shittyHardCutout ? 0.08 : 0.02)
                        : (runtimeConfig.shittyHardCutout ? 0.16 : 0.08);
                    const dropoutChance = shittyVoiceBoost
                        ? (runtimeConfig.shittyHardCutout ? 0.45 : 0.2) + dropoutMix * 0.5
                        : (runtimeConfig.shittyHardCutout ? 0.55 : 0.25) + dropoutMix * 0.45;
                    if (Math.random() < 0.9) latch = Math.random() < 0.5 ? -1 : 1;

                    const hiss = (Math.random() * 2 - 1) * (0.02 + staticMix * 0.35);
                    const digitalNoise = latch * ((shittyVoiceBoost ? 0.2 * boostMultiplier : 0.2) + level * (shittyVoiceBoost ? 0.18 * boostMultiplier : 0.18)) + hiss;
                    heldSamples[channel] = level < gateThreshold || Math.random() < dropoutChance
                        ? 0
                        : Math.max(-(shittyVoiceBoost ? 0.35 * boostMultiplier : 0.35), Math.min(shittyVoiceBoost ? 0.35 * boostMultiplier : 0.35, digitalNoise));
                }

                const bitcrushMix = runtimeConfig.shittyBitcrushPercent / 100;
                const clippingMix = runtimeConfig.shittyClippingPercent / 100;
                const flutterMix = runtimeConfig.shittyFlutterPercent / 100;
                const voiceBoostMix = runtimeConfig.shittyVoiceBoostPercent / 100;
                const blownVoice = voiceBoostMix > 0 || pitchShiftMix > 0
                    ? Math.max(-1, Math.min(1, pitchedSample * (8 + voiceBoostMix * 40 + pitchShiftMix * 18)))
                    : 0;
                const flutter = flutterMix > 0
                    ? Math.sin(flutterPhase) * flutterMix * 0.22
                    : 0;
                const crushedStep = Math.max(0.02, 0.4 - bitcrushMix * 0.35);
                const clipLimit = Math.max(0.08, 0.85 - clippingMix * 0.72);
                const pitchLead = pitchShiftMix > 0 ? pitchedSample * (0.45 + pitchShiftMix * 0.75) : 0;
                const mixed = heldSamples[channel] * (pitchShiftMix > 0 ? 0.35 : 1)
                    + blownVoice * Math.max(0.45, voiceBoostMix * 1.25 + pitchShiftMix * 0.8)
                    + pitchLead
                    + flutter;
                const crushed = Math.round(mixed / crushedStep) * crushedStep;
                output[index] = Math.max(-clipLimit, Math.min(clipLimit, crushed));
                holdCounter = (holdCounter + 1) % 640;
                flutterPhase += 0.18 + flutterMix * 0.42;
            }
        }
    };

    return processor;
};

export const wrapMicrophoneStream = async (stream: MediaStream, constraints: MediaStreamConstraints) => {
    if (managedMicrophoneStreams.has(stream)) return stream;
    if (!shouldUseMicrophoneTweaks(constraints) || stream.getAudioTracks().length === 0) return stream;

    const microphoneConfig = getMicrophoneRuntimeConfig();
    if (microphoneConfig.routing === "stereo" && !microphoneConfig.degradeAudio && microphoneConfig.shittyPitchShiftPercent <= 0 && microphoneConfig.cleanGain === 1) return stream;

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) return stream;

    const context = new AudioContextCtor({ sampleRate: microphoneConfig.sampleRate });
    const source = context.createMediaStreamSource(stream);
    const splitter = context.createChannelSplitter(2);
    const merger = context.createChannelMerger(2);
    const destination = context.createMediaStreamDestination();
    const leftGain = context.createGain();
    const rightGain = context.createGain();
    const highPass = context.createBiquadFilter();
    const lowPass = context.createBiquadFilter();
    const drive = context.createGain();
    const shaper = context.createWaveShaper();
    const processor = createShittyMicProcessor(context);
    const cleanGain = context.createGain();
    const dirtyGain = context.createGain();
    const outputGain = context.createGain();
    const boostGain = context.createGain();
    const bassBoostFilter = context.createBiquadFilter();
    const voiceBoostDrive = context.createGain();
    const voiceBoostGain = context.createGain();

    source.connect(splitter);

    switch (microphoneConfig.routing) {
        case "swapStereo":
            splitter.connect(leftGain, 1, 0);
            splitter.connect(rightGain, 0, 0);
            leftGain.connect(merger, 0, 0);
            rightGain.connect(merger, 0, 1);
            break;
        case "dualMonoLeft":
            connectDualMono(splitter, merger, 0, leftGain, rightGain);
            break;
        case "dualMonoRight":
            connectDualMono(splitter, merger, 1, leftGain, rightGain);
            break;
        case "monoMix":
            connectMonoMix(splitter, merger, leftGain, rightGain);
            break;
        default:
            source.connect(merger, 0, 0);
            source.connect(merger, 0, 1);
    }

    highPass.type = "highpass";
    lowPass.type = "lowpass";
    shaper.curve = createShittyMicCurve();
    shaper.oversample = "none";

    merger.connect(cleanGain);
    cleanGain.connect(destination);

    merger.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(drive);
    drive.connect(shaper);
    shaper.connect(processor);
    processor.connect(outputGain);
    outputGain.connect(dirtyGain);
    dirtyGain.connect(boostGain);
    boostGain.connect(destination);

    bassBoostFilter.type = "lowshelf";

    merger.connect(bassBoostFilter);
    bassBoostFilter.connect(voiceBoostDrive);
    voiceBoostDrive.connect(voiceBoostGain);
    voiceBoostGain.connect(destination);

    const sync = () => {
        const { degradeAudio } = getMicrophoneRuntimeConfig();
        const { cleanGain: cleanGainFactor, shittyBassBoostPercent, shittyBassResonancePercent, shittyMufflePercent, shittyStaticPercent, shittyVoiceBoostPercent } = getMicrophoneRuntimeConfig();

        cleanGain.gain.value = degradeAudio ? 0 : cleanGainFactor;
        dirtyGain.gain.value = degradeAudio ? 1 : 0;
        highPass.frequency.value = 3000;
        highPass.Q.value = 7;
        lowPass.frequency.value = degradeAudio ? 3600 - shittyMufflePercent * 24 : 3600;
        lowPass.Q.value = 7;
        drive.gain.value = 55;
        outputGain.gain.value = degradeAudio ? 0.45 + shittyVoiceBoostPercent / 25 + shittyStaticPercent / 250 : 1;
        boostGain.gain.value = degradeAudio ? 1 + shittyVoiceBoostPercent / 2 : 1;
        bassBoostFilter.frequency.value = 180;
        bassBoostFilter.gain.value = degradeAudio ? shittyBassBoostPercent / 4 : 0;
        bassBoostFilter.Q.value = degradeAudio ? 0.7 + shittyBassResonancePercent / 20 : 0.7;
        voiceBoostDrive.gain.value = degradeAudio ? 1 + shittyVoiceBoostPercent / 2 : 1;
        voiceBoostGain.gain.value = degradeAudio ? shittyVoiceBoostPercent / 6 : 0;
    };

    sync();

    const cleanup = () => {
        activeManagedMicrophoneStreams.delete(managedStream);
        managedMicrophoneStreams.delete(destination.stream);
        stopStream(destination.stream);
        stopStream(stream);
        void context.close();
    };
    const managedStream = { cleanup, sync };
    activeManagedMicrophoneStreams.add(managedStream);
    managedMicrophoneStreams.set(destination.stream, managedStream);

    const releaseOriginal = () => cleanup();
    for (const track of stream.getTracks()) {
        track.addEventListener("ended", releaseOriginal, { once: true });
    }

    if (context.state === "suspended") {
        return context.resume().then(() => destination.stream, () => destination.stream);
    }

    return destination.stream;
};

export const releaseMicrophoneStream = (stream: MediaStream) => {
    const managedStream = managedMicrophoneStreams.get(stream);
    if (managedStream != null) {
        managedStream.cleanup();
        return;
    }

    stopStream(stream);
};

export const syncLiveMicrophoneEffects = () => {
    if (!activeManagedMicrophoneStreams.size) return false;

    for (const managedStream of activeManagedMicrophoneStreams) {
        managedStream.sync();
    }

    return true;
};

export const installMicrophoneInterceptor = () => {
    if (restoreMicrophoneInterceptor) return;

    const restoreCallbacks: Array<() => void> = [];
    const installVersion = ++microphoneInterceptorVersion;
    const mediaDevices = getMediaDevices();
    const originalGetUserMedia = mediaDevices?.getUserMedia;
    if (mediaDevices && originalGetUserMedia) {
        mediaDevices.getUserMedia = function (constraints) {
            return originalGetUserMedia.call(this, prepareMicrophoneConstraints(constraints))
                .then(stream => wrapMicrophoneStream(stream, constraints));
        };

        restoreCallbacks.push(() => {
            mediaDevices.getUserMedia = originalGetUserMedia;
        });
    }

    waitFor(microphoneManagerFilter, manager => {
        if (microphoneInterceptorVersion !== installVersion || !restoreMicrophoneInterceptor) return;

        const { prototype } = manager as MicrophoneManagerLike;
        const originalAcquire = prototype?.acquire;
        const originalRelease = prototype?.release;

        if (!prototype || !originalAcquire || !originalRelease) return;

        prototype.acquire = function (constraints) {
            return originalAcquire.call(this, prepareMicrophoneConstraints(constraints))
                .then(stream => wrapMicrophoneStream(stream, constraints));
        };

        prototype.release = function (stream) {
            releaseMicrophoneStream(stream);
        };

        restoreCallbacks.push(() => {
            prototype.acquire = originalAcquire;
            prototype.release = originalRelease;
        });
    }, { isIndirect: true });

    if (!restoreCallbacks.length) return;

    restoreMicrophoneInterceptor = () => {
        microphoneInterceptorVersion++;
        for (const restore of restoreCallbacks) restore();
        restoreMicrophoneInterceptor = null;
    };
};

export const uninstallMicrophoneInterceptor = () => {
    restoreMicrophoneInterceptor?.();
};
