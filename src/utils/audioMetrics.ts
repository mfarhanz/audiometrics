import type { AudioStats } from "../types/metadata";

/**
 * Evaluates spectral, temporal, and spatial metrics to produce audiophile descriptors.
 */
export function deriveAudioDescriptors(stats: AudioStats) {
    const descriptors = [];

    const hasRightChannel = stats.channels > 1;
    const sdrVal = stats.sdrVal;
    const crestFactorDb = stats.crestFactorDb;
    const zcrHz = stats.zcrHz;
    const kurtosis = stats.kurtosis;
    const rmsDb = stats.rmsDb;
    const stereoCorrelationVal = stats.stereoCorrelationVal;
    const clipCount = stats.clipCount;
    const totalSamples = stats.totalSamples;


    // Dynamic Profile & Energy
    if (crestFactorDb > 18) descriptors.push("Dynamic");
    if (crestFactorDb > 15 && hasRightChannel && stereoCorrelationVal <= 0.5) descriptors.push("Expansive");
    if (crestFactorDb >= 12 && kurtosis > 1.5) descriptors.push("Lively");
    if (crestFactorDb >= 10 && crestFactorDb < 15) descriptors.push("Punchy");
    if (crestFactorDb >= 8 && crestFactorDb < 12 && rmsDb < -15) descriptors.push("Laid-back");
    if (crestFactorDb >= 8 && crestFactorDb < 12 && rmsDb >= -15) descriptors.push("Balanced Energy");
    if (crestFactorDb < 8) descriptors.push("Compressed");
    if (crestFactorDb < 7 && rmsDb > -10) descriptors.push("Congested");
    if (crestFactorDb < 6 && kurtosis < 0.5) descriptors.push("Flat");

    // Pitch & Timbral Bias (ZCR)

    if (zcrHz < 100) descriptors.push("Deep");
    if (zcrHz >= 100 && zcrHz < 200 && crestFactorDb > 12) descriptors.push("Boomy");
    if (zcrHz >= 100 && zcrHz < 250 && kurtosis < 1.0) descriptors.push("Bloated");
    if (zcrHz >= 200 && zcrHz < 350) descriptors.push("Bassy");
    if (zcrHz >= 250 && zcrHz < 500 && sdrVal !== null && (isNaN(sdrVal) || sdrVal >= 40)) descriptors.push("Warm");
    if (zcrHz >= 300 && zcrHz < 600 && kurtosis < 0.0) descriptors.push("Dark");
    if (zcrHz >= 500 && zcrHz <= 1200 && crestFactorDb >= 9) descriptors.push("Mellow");
    if (zcrHz >= 800 && zcrHz <= 1800 && kurtosis >= 0.0 && kurtosis <= 2.5) descriptors.push("Balanced Tone");
    if (zcrHz > 1800 && zcrHz <= 2800) descriptors.push("Bright");
    if (zcrHz > 2200 && zcrHz <= 3500 && kurtosis > 2.0) descriptors.push("Crisp");
    if (zcrHz > 2800 && zcrHz <= 4000 && kurtosis > 4.0) descriptors.push("Edgy");
    if (zcrHz > 3500 && zcrHz <= 5000 && clipCount > 0) descriptors.push("Sharp");
    if (zcrHz > 4500 && sdrVal !== null && (isNaN(sdrVal) || sdrVal >= 50)) descriptors.push("Airy");
    if (zcrHz > 5000 && crestFactorDb < 9) descriptors.push("Shrill");
    if (zcrHz > 5000 && kurtosis < 0) descriptors.push("Chilly");

    // Transient Response & Envelope (Kurtosis)
    if (kurtosis > 6.0 && rmsDb > -12) descriptors.push("Aggressive");
    if (kurtosis > 5.0 && crestFactorDb > 14) descriptors.push("Impulsive");
    if (kurtosis > 5.0 && clipCount > 0) descriptors.push("Jarring");
    if (kurtosis > 2.5 && kurtosis <= 5.0) descriptors.push("Sharp Transients");
    if (kurtosis >= 0.5 && kurtosis <= 2.5 && crestFactorDb >= 12) descriptors.push("Analytical");
    if (kurtosis >= 0.0 && kurtosis < 1.0 && sdrVal !== null && (isNaN(sdrVal) || sdrVal >= 45)) descriptors.push("Precise");
    if (kurtosis >= -0.8 && kurtosis < 0.0) descriptors.push("Smooth");
    if (kurtosis >= -1.2 && kurtosis < -0.5 && zcrHz < 1000) descriptors.push("Soft");
    if (kurtosis < -1.2 && crestFactorDb < 8) descriptors.push("Sustained");
    if (kurtosis < -1.4 && rmsDb < -25) descriptors.push("Dead");

    // Clarity, Noise Floor & Distortion
    const clipRatio = clipCount / totalSamples;
    if (clipRatio > 0.01) descriptors.push("Abrasive");
    if (clipCount > 0 && clipRatio <= 0.01 && zcrHz > 2000) descriptors.push("Gritty");
    if (clipCount > 0 && zcrHz < 500) descriptors.push("Buzzy");
    if (clipRatio > 0.03) descriptors.push("Crude");
    if (clipCount > 0 && clipRatio <= 0.005) descriptors.push("Grating");
    if (clipCount > 0 && kurtosis > 3.0) descriptors.push("Edgy Distortion");
    if (sdrVal !== null) {
        if (!isNaN(sdrVal) && sdrVal < 20) descriptors.push("Chalky");
        if (!isNaN(sdrVal) && sdrVal >= 20 && sdrVal < 35) descriptors.push("Hazy");
        if (!isNaN(sdrVal) && sdrVal < 30 && kurtosis < 0) descriptors.push("Dry");
        if (clipCount === 0 && (isNaN(sdrVal) || sdrVal >= 40) && crestFactorDb >= 10) descriptors.push("Clear");
        if (clipCount === 0 && (isNaN(sdrVal) || sdrVal >= 50) && kurtosis > 1.5 && crestFactorDb > 12) descriptors.push("Aliveness");
    }

    // Stereo Field & Spatial Imaging
    if (hasRightChannel) {
        if (stereoCorrelationVal < -0.2) descriptors.push("Out-of-Phase Spurious");
        else if (stereoCorrelationVal < 0.1) descriptors.push("Diffused");
        else if (stereoCorrelationVal <= 0.3) descriptors.push("Pinched");

        if (stereoCorrelationVal > 0.0 && stereoCorrelationVal <= 0.35 && crestFactorDb > 12) descriptors.push("Expansive Field");
        if (stereoCorrelationVal > 0.35 && stereoCorrelationVal <= 0.75) descriptors.push("Wide Field");
        if (stereoCorrelationVal > 0.75 && stereoCorrelationVal <= 0.88) descriptors.push("Balanced Imaging");
        if (stereoCorrelationVal > 0.88 && stereoCorrelationVal < 0.98) descriptors.push("Centered Focus");
        if (stereoCorrelationVal >= 0.98) descriptors.push("Boxy");
    }

    return descriptors.length > 0 ? descriptors : ["Neutral / Standard"];
}
