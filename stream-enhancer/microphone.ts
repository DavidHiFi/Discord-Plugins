/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { filters, waitFor } from "@webpack";

import { createMicEffectEngine, deriveMicEffectParams, isMicEffectActive } from "./micEffects";
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

// Soft saturation with close to unity gain for quiet input. The earlier hard clamp to
// +-0.015 turned the voice into a one-bit signal, so the envelope the effects depend on was gone.
const createSoftClipCurve = () => {
    const curve = new Float32Array(1024);

    for (let index = 0; index < curve.length; index++) {
        const sample = index / (curve.length - 1) * 2 - 1;
        curve[index] = Math.tanh(sample) / Math.tanh(1);
    }

    return curve;
};

// Runs the bad-mic effects on the mono sum. The engine reads config once per
// buffer, not once per sample. Buffers stay small at low sample rates so the
// latency does not grow to a quarter second.
const createMicEffectProcessor = (context: AudioContext) => {
    const processor = context.createScriptProcessor(context.sampleRate < 16000 ? 512 : 2048, 2, 2);
    const engine = createMicEffectEngine(context.sampleRate);
    let mono = new Float32Array(processor.bufferSize);
    let processed = new Float32Array(processor.bufferSize);

    processor.onaudioprocess = event => {
        const { inputBuffer, outputBuffer } = event;
        const left = inputBuffer.getChannelData(0);
        const right = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : left;
        const leftOut = outputBuffer.getChannelData(0);
        const rightOut = outputBuffer.numberOfChannels > 1 ? outputBuffer.getChannelData(1) : leftOut;
        const config = getMicrophoneRuntimeConfig();

        if (!config.effectsActive) {
            leftOut.fill(0);
            rightOut.fill(0);
            return;
        }

        if (mono.length !== left.length) {
            mono = new Float32Array(left.length);
            processed = new Float32Array(left.length);
        }

        for (let index = 0; index < left.length; index++) {
            mono[index] = (left[index] + right[index]) * 0.5;
        }

        // Bass, resonance or muffle alone have no engine stage, so pass the voice through.
        if (isMicEffectActive(config.effects)) engine.process(mono, processed, deriveMicEffectParams(config.effects));
        else processed.set(mono);

        for (let index = 0; index < leftOut.length; index++) {
            leftOut[index] = processed[index];
            rightOut[index] = processed[index];
        }
    };

    return processor;
};

export const wrapMicrophoneStream = async (stream: MediaStream, constraints: MediaStreamConstraints) => {
    if (managedMicrophoneStreams.has(stream)) return stream;
    if (!shouldUseMicrophoneTweaks(constraints) || stream.getAudioTracks().length === 0) return stream;

    const microphoneConfig = getMicrophoneRuntimeConfig();
    if (microphoneConfig.routing === "stereo" && !microphoneConfig.effectsActive && microphoneConfig.cleanGain === 1) return stream;

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) return stream;

    const context = new AudioContextCtor({ sampleRate: microphoneConfig.sampleRate });
    const source = context.createMediaStreamSource(stream);
    const splitter = context.createChannelSplitter(2);
    const merger = context.createChannelMerger(2);
    const destination = context.createMediaStreamDestination();
    const leftGain = context.createGain();
    const rightGain = context.createGain();
    const cleanGain = context.createGain();
    const highPass = context.createBiquadFilter();
    const lowPass = context.createBiquadFilter();
    const drive = context.createGain();
    const shaper = context.createWaveShaper();
    const processor = createMicEffectProcessor(context);
    const bassShelf = context.createBiquadFilter();
    const limiter = context.createDynamicsCompressor();
    const wetGain = context.createGain();

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

    // Clean path: the input at the mic gain, used whenever no effect is active.
    merger.connect(cleanGain);
    cleanGain.connect(destination);

    // Effect path: band-limit for the radio/telephone character, saturate, then the processor.
    highPass.type = "highpass";
    highPass.frequency.value = 200;
    highPass.Q.value = 0.7;
    lowPass.type = "lowpass";
    lowPass.Q.value = 0.7;
    shaper.curve = createSoftClipCurve();
    shaper.oversample = "2x";
    bassShelf.type = "lowshelf";
    bassShelf.frequency.value = 180;

    merger.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(drive);
    drive.connect(shaper);
    shaper.connect(processor);
    processor.connect(bassShelf);
    bassShelf.connect(limiter);
    limiter.connect(wetGain);
    wetGain.connect(destination);

    // Bass boost and the amplifier can push the wet path past full scale; this keeps it inside.
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;

    const sync = () => {
        const config = getMicrophoneRuntimeConfig();
        const active = config.effectsActive;

        cleanGain.gain.value = active ? 0 : config.cleanGain;
        wetGain.gain.value = active ? 1 : 0;
        drive.gain.value = 1;
        lowPass.frequency.value = config.shittyLowPassHz;
        bassShelf.gain.value = active ? config.shittyBassBoostDb : 0;
        bassShelf.Q.value = 0.7 + config.shittyBassResonancePercent / 20;
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
