/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// DSP for the bad-mic voice effects. No Discord or WebAudio imports, so the node
// tests in tests/stream-enhancer-mic-effects.test.ts can run it directly.

export interface MicEffectSettings {
    /** -50..100. 100 raises the voice one octave, -100 lowers it one octave. */
    pitchPercent: number;
    echoPercent: number;
    /** Ring-modulation depth on a fixed carrier of MIC_RING_HZ. */
    ringPercent: number;
    staticPercent: number;
    dropoutPercent: number;
    bitcrushPercent: number;
    clippingPercent: number;
    voiceBoostPercent: number;
    hardCutout: boolean;
}

export interface MicEffectParams {
    pitchRatio: number;
    echoMix: number;
    echoFeedback: number;
    ringMix: number;
    gateThreshold: number;
    dropoutChance: number;
    staticLevel: number;
    crushStep: number;
    clipLimit: number;
    makeupGain: number;
}

export const MIC_RING_HZ = 55;

const ECHO_SECONDS = 0.28;
const PITCH_WINDOW_SECONDS = 0.04;
const PITCH_BUFFER_SIZE = 8192;
const ENVELOPE_RELEASE_SECONDS = 0.04;
const DROPOUT_HOLD_SECONDS = 640 / 48000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const nextPowerOfTwo = (value: number) => {
    let size = 1;
    while (size < value) size *= 2;
    return size;
};

export const isMicEffectActive = (settings: MicEffectSettings) =>
    settings.pitchPercent !== 0
    || settings.echoPercent > 0
    || settings.ringPercent > 0
    || settings.staticPercent > 0
    || settings.dropoutPercent > 0
    || settings.bitcrushPercent > 0
    || settings.clippingPercent > 0
    || settings.voiceBoostPercent > 0
    || settings.hardCutout;

export const deriveMicEffectParams = (settings: MicEffectSettings): MicEffectParams => {
    const bits = Math.round(16 - settings.bitcrushPercent / 100 * 12);

    return {
        pitchRatio: 2 ** (clamp(settings.pitchPercent, -100, 100) / 100),
        echoMix: settings.echoPercent / 100 * 0.6,
        echoFeedback: 0.2 + settings.echoPercent / 100 * 0.45,
        ringMix: settings.ringPercent / 100,
        gateThreshold: settings.hardCutout ? 0.05 : 0.02,
        dropoutChance: clamp(settings.dropoutPercent / 100 * 0.5 + (settings.hardCutout ? 0.2 : 0), 0, 0.9),
        staticLevel: settings.staticPercent / 100 * 0.08,
        crushStep: settings.bitcrushPercent > 0 ? 2 / 2 ** bits : 0,
        clipLimit: 1 - settings.clippingPercent / 100 * 0.75,
        makeupGain: 1 + settings.voiceBoostPercent / 100 * 2
    };
};

export const createMicEffectEngine = (sampleRate: number, seed = 1) => {
    const pitchWindow = clamp(Math.round(PITCH_WINDOW_SECONDS * sampleRate), 64, 4096);
    const pitchMask = PITCH_BUFFER_SIZE - 1;
    const pitchBuffer = new Float32Array(PITCH_BUFFER_SIZE);
    let pitchWrite = 0;
    let pitchPhase = 0;

    const echoDelay = Math.max(1, Math.round(ECHO_SECONDS * sampleRate));
    const echoBuffer = new Float32Array(nextPowerOfTwo(echoDelay + 1));
    const echoMask = echoBuffer.length - 1;
    let echoWrite = 0;

    const ringStep = 2 * Math.PI * MIC_RING_HZ / sampleRate;
    let ringPhase = 0;

    const releaseCoefficient = Math.exp(-1 / (ENVELOPE_RELEASE_SECONDS * sampleRate));
    const holdSamples = Math.max(1, Math.round(DROPOUT_HOLD_SECONDS * sampleRate));
    let envelope = 0;
    let holdCounter = 0;
    let dropped = false;
    let randomState = seed;

    // Seeded so the tests are repeatable; the static and dropout patterns only need to sound random.
    const random = () => {
        randomState = (randomState * 16807) % 2147483647;
        return randomState / 2147483647;
    };

    const readPitch = (delay: number) => {
        const position = pitchWrite - delay;
        const index = Math.floor(position);
        const fraction = position - index;
        const first = pitchBuffer[index & pitchMask];
        const second = pitchBuffer[(index + 1) & pitchMask];
        return first + (second - first) * fraction;
    };

    // Two read heads half a window apart, crossfaded with sin^2 windows that sum to 1.
    // Reading faster than the input (ratio above 1) raises the pitch; slower lowers it.
    const shiftPitch = (sample: number, ratio: number) => {
        pitchBuffer[pitchWrite] = sample;
        pitchPhase += (1 - ratio) / pitchWindow;
        if (pitchPhase < 0) pitchPhase += 1;
        else if (pitchPhase >= 1) pitchPhase -= 1;

        const otherPhase = pitchPhase < 0.5 ? pitchPhase + 0.5 : pitchPhase - 0.5;
        const gain = Math.sin(Math.PI * pitchPhase) ** 2;
        const otherGain = Math.sin(Math.PI * otherPhase) ** 2;
        const shifted = readPitch(pitchPhase * pitchWindow) * gain + readPitch(otherPhase * pitchWindow) * otherGain;

        pitchWrite = (pitchWrite + 1) & pitchMask;
        return shifted;
    };

    const applyEcho = (sample: number, mix: number, feedback: number) => {
        const delayed = echoBuffer[(echoWrite - echoDelay) & echoMask];
        echoBuffer[echoWrite] = sample + delayed * feedback;
        echoWrite = (echoWrite + 1) & echoMask;
        return sample + delayed * mix;
    };

    const applyRing = (sample: number, mix: number) => {
        const carrier = Math.sin(ringPhase);
        ringPhase += ringStep;
        if (ringPhase >= 2 * Math.PI) ringPhase -= 2 * Math.PI;
        return sample * (1 - mix + mix * carrier);
    };

    // Gate, dropouts, static, bit crush and clipping run on the processed voice,
    // so the voice's own envelope decides when the gate opens.
    const finish = (sample: number, params: MicEffectParams) => {
        const magnitude = Math.abs(sample);
        envelope = magnitude > envelope ? magnitude : envelope * releaseCoefficient;

        if (holdCounter <= 0) {
            holdCounter = holdSamples;
            dropped = random() < params.dropoutChance;
        }
        holdCounter--;

        const open = !dropped && envelope >= params.gateThreshold;
        let value = open ? sample : 0;
        if (open && params.staticLevel > 0) value += (random() * 2 - 1) * params.staticLevel;
        if (params.crushStep > 0) value = Math.round(value / params.crushStep) * params.crushStep;

        return clamp(value * params.makeupGain, -params.clipLimit, params.clipLimit);
    };

    const process = (input: Float32Array, output: Float32Array, params: MicEffectParams) => {
        const pitchEnabled = params.pitchRatio !== 1;
        const echoEnabled = params.echoMix > 0;
        const ringEnabled = params.ringMix > 0;

        for (let index = 0; index < input.length; index++) {
            let sample = input[index];
            if (pitchEnabled) sample = shiftPitch(sample, params.pitchRatio);
            if (echoEnabled) sample = applyEcho(sample, params.echoMix, params.echoFeedback);
            if (ringEnabled) sample = applyRing(sample, params.ringMix);
            output[index] = finish(sample, params);
        }
    };

    return { process };
};
