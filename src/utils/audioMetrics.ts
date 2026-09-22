import type { AudioStats } from "../types/metadata";

/**
 * Evaluates spectral, temporal, and spatial metrics to produce audiophile descriptors.
 */
export function deriveAudioDescriptors(stats: AudioStats): string[] {
    const descriptors: string[] = [];

    const {
        channels, crestFactorDb, rmsDb, kurtosis, clipCount, totalSamples,
        stereoCorrelationVal, envelopePeakToMeanRatio, temporalCentroidNorm, zcrHz,
        avgCentroid, avgSpread, avgRolloff, avgFlatness, avgCrestFactor,
        avgBandEnergyRatio, avgSlope, avgFlux, bpm: rawBpm, confidence: tempoConfidence
    } = stats;

    const sdrDbVal = stats.sdrVal ?? 60;
    const isMono = channels === 1;
    const clipRatio = clipCount / (totalSamples || 1);

    // =========================================================================
    // 0. TEMPO NORMALIZATION
    // =========================================================================
    let effectiveBpm = rawBpm;
    if (rawBpm > 0) {
        if (rawBpm < 85 && (avgFlux > 0.55 || kurtosis > 2.8)) {
            effectiveBpm = rawBpm * 2; // Normalizes half-time trap/metal readings
        } else if (rawBpm > 175 && avgFlux < 0.35 && kurtosis < 1.0) {
            effectiveBpm = rawBpm / 2;
        }
    }

    const isLoud = rmsDb > -14;
    const isVeryLoud = rmsDb > -10;
    const isQuiet = rmsDb < -22;

    // =========================================================================
    // 1. BASS & LOW-END (Split into Sub vs Mid-Bass channels)
    // =========================================================================
    // Deep / Sub Bass Chain
    if (avgCentroid < 650 && avgBandEnergyRatio > 0.58 && zcrHz < 120) {
        descriptors.push("Sub Bass");
    } else if (avgCentroid < 850 && avgSlope < -0.00035 && avgBandEnergyRatio > 0.50) {
        descriptors.push("Rumbling Bass");
    } else if (avgCentroid < 1100 && avgBandEnergyRatio > 0.42) {
        descriptors.push("Deep Low-End");
    } else if (avgCentroid < 1500 && avgSlope < -0.00020 && rmsDb > -16) {
        descriptors.push("Heavy Bass");
    }

    // Mid-Bass / Punch Chain (Evaluated separately as kicks can coexist with sub)
    if (zcrHz >= 80 && zcrHz < 190 && envelopePeakToMeanRatio > 5.2 && avgBandEnergyRatio > 0.35) {
        descriptors.push("Punchy Mid-Bass");
    } else if (zcrHz >= 100 && zcrHz < 240 && crestFactorDb > 11.5 && avgSpread > 2000) {
        descriptors.push("Boomy Resonance");
    }

    // =========================================================================
    // 2. PITCH, TUNE & HARMONIC STRUCTURE
    // =========================================================================
    if (avgFlatness > 0.45 && avgCrestFactor < 2.0) {
        descriptors.push("Atonal Noise");
    } else if (avgFlatness > 0.35 && avgCentroid > 3000 && kurtosis > 3.0) {
        descriptors.push("Unpitched Transients");
    } else if (avgFlatness < 0.05 && avgCrestFactor > 4.2) {
        descriptors.push("Monophonic Pure Tone");
    } else if (avgFlatness < 0.09 && avgCrestFactor > 3.2) {
        descriptors.push("Resonant Harmonics");
    } else if (avgFlatness >= 0.15 && avgFlatness <= 0.28 && avgSpread > 2500) {
        descriptors.push("Polyphonic Texture");
    }

    if (avgFlux > 0.85 && avgCrestFactor > 4.0 && avgFlatness < 0.18) {
        descriptors.push("Pitch Glides"); // e.g., 808 slides, synth portamento
    }

    if (avgSpread > 3600 && avgFlatness > 0.28 && avgFlatness < 0.45) {
        descriptors.push("Dissonant Harmonics");
    }

    // =========================================================================
    // 3. DYNAMIC PROFILE & ENVELOPE
    // =========================================================================
    if (crestFactorDb > 18.5 && rmsDb < -14) {
        descriptors.push("Highly Dynamic");
    } else if (crestFactorDb >= 13 && crestFactorDb <= 18.5 && kurtosis > 2.0) {
        descriptors.push("Punchy Dynamics");
    } else if (crestFactorDb < 8.0 && isVeryLoud && avgFlatness > 0.20) {
        descriptors.push("Wall of Sound");
    } else if (crestFactorDb < 8.5 && isVeryLoud) {
        descriptors.push("High Density");
    } else if (crestFactorDb < 9.0 && !isVeryLoud) {
        descriptors.push("Compressed Dynamics");
    }

    if (temporalCentroidNorm < 0.30) {
        descriptors.push("Front-Loaded Energy");
    } else if (temporalCentroidNorm > 0.70) {
        descriptors.push("Swelling Crescendo");
    }

    // =========================================================================
    // 4. TIMBRE & SPECTRUM PROFILE
    // =========================================================================
    if (avgCentroid > 4200 && avgRolloff > 9000 && avgFlatness > 0.22) {
        descriptors.push("Airy");
    } else if (avgCentroid > 3800 && avgRolloff > 8200) {
        descriptors.push("Crisp");
    } else if (avgCentroid > 2800 && avgRolloff > 6000) {
        descriptors.push("Bright");
    } else if (avgCentroid >= 1800 && avgCentroid <= 2800 && avgSpread < 3000) {
        descriptors.push("Clear Midrange");
    } else if (avgCentroid >= 1200 && avgCentroid < 1800 && avgBandEnergyRatio > 0.45) {
        descriptors.push("Warm Tone");
    } else if (avgCentroid < 850 && avgRolloff < 2500) {
        descriptors.push("Muffled");
    } else if (avgCentroid < 1200 && avgRolloff < 3500) {
        descriptors.push("Dark Tone");
    }

    if (avgSpread > 4000) {
        descriptors.push("Wide Frequency Spectrum");
    } else if (avgSpread < 1100 && avgFlatness < 0.30) {
        descriptors.push("Narrow Bandwidth");
    }

    // =========================================================================
    // 5. TRANSIENTS, RHYTHM & TEMPO
    // =========================================================================
    if (kurtosis > 4.8 && envelopePeakToMeanRatio > 6.8) {
        descriptors.push("Sharp Transients");
    } else if (kurtosis > 3.8 || envelopePeakToMeanRatio > 5.8) {
        descriptors.push("Percussive Pulse");
    } else if (kurtosis < 0.25 && avgFlux < 0.25) {
        descriptors.push("Smooth Sustained");
    }

    if (tempoConfidence > 0.35 || effectiveBpm > 0) {
        if (effectiveBpm >= 142) {
            descriptors.push("Fast Tempo");
        } else if (effectiveBpm >= 100 && effectiveBpm < 142) {
            descriptors.push("Mid-Tempo Driven");
        } else if (effectiveBpm > 0 && effectiveBpm < 100) {
            descriptors.push("Down-Tempo");
        }
    } else if (avgFlux < 0.18 && crestFactorDb < 8.5) {
        descriptors.push("Ambient Texture");
    }

    // =========================================================================
    // 6. MULTI-FEATURE VIBE, MOOD & GENRE DESCRIPTORS
    // =========================================================================
    const energyScore = (isLoud ? 2 : 0) + (avgFlux > 0.65 ? 2 : 0) + (kurtosis > 3.5 ? 1 : 0);
    const saturationScore = clipRatio > 0.002 ? 2 : (avgFlatness > 0.22 && isLoud) ? 1 : 0;

    // Heavy / Industrial / Abrasive
    if (avgFlatness > 0.30 && kurtosis > 3.5 && saturationScore >= 1) {
        descriptors.push("Industrial Mechanical");
    } else if (saturationScore >= 1 && energyScore >= 4 && effectiveBpm >= 120) {
        descriptors.push("Aggressive");
    } else if (saturationScore >= 1 && crestFactorDb > 12) {
        descriptors.push("Raw Heavy");
    } else if (saturationScore >= 2 && avgCentroid > 3400) {
        descriptors.push("Abrasive");
    } else if (avgCentroid > 4000 && zcrHz > 2500 && isLoud) {
        descriptors.push("Harsh Piercing");
    }

    // Upbeat / Energetic
    if (energyScore >= 3 && effectiveBpm >= 130) {
        descriptors.push("Highly Energetic");
    } else if (effectiveBpm >= 112 && effectiveBpm <= 128 && (crestFactorDb > 11 || envelopePeakToMeanRatio > 5.5)) {
        descriptors.push("Danceable Groove");
    }
    if (avgCentroid > 2500 && energyScore >= 2 && effectiveBpm >= 105 && saturationScore === 0) {
        descriptors.push("Upbeat Vibrant");
    }

    // Groove / Hypnotic
    if (effectiveBpm >= 75 && effectiveBpm <= 110 && avgFlux >= 0.40 && crestFactorDb < 10) {
        descriptors.push("Hypnotic Rhythm");
    }

    // Spatial / Epic / Cinematic
    if (!isMono && stereoCorrelationVal < 0.45 && avgSpread > 2600 && crestFactorDb > 11) {
        descriptors.push("Atmospheric Spatial");
    }
    if (temporalCentroidNorm > 0.65 && avgSpread > 3500 && crestFactorDb > 14) {
        descriptors.push("Cinematic Epic");
    }
    if (isQuiet && avgCentroid > 3000 && kurtosis < 0.3 && !isMono) {
        descriptors.push("Ethereal Floating");
    }

    // Dark / Ominous
    if (avgCentroid < 1150 && energyScore <= 2 && avgBandEnergyRatio > 0.35) {
        descriptors.push("Dark Moody");
    }
    if (avgCentroid < 800 && avgSpread > 3500 && avgFlatness > 0.25 && effectiveBpm < 100) {
        descriptors.push("Ominous");
    }

    // Acoustic / Organic
    if (crestFactorDb > 14 && saturationScore === 0 && sdrDbVal > 40 && avgSpread > 2000) {
        descriptors.push("Organic Acoustic");
    }

    // Meditative
    if (isQuiet && kurtosis < 0.25 && avgFlux < 0.22 && avgFlatness < 0.15) {
        descriptors.push("Meditative Calm");
    }

    // =========================================================================
    // 7. QUALITY, TEXTURE & SPATIAL IMAGING
    // =========================================================================
    // Lo-Fi / Vintage / Gritty
    if (sdrDbVal < 32 && avgSpread < 1900 && avgRolloff < 4500) {
        descriptors.push("Lo-Fi Textures");
    } else if (sdrDbVal >= 20 && sdrDbVal <= 35 && avgRolloff < 6000 && stereoCorrelationVal > 0.5) {
        descriptors.push("Vintage Vinyl-Like");
    }

    if ((clipCount > 0 && clipRatio <= 0.003) || (saturationScore === 1 && sdrDbVal >= 32)) {
        descriptors.push("Gritty Overdrive");
    }

    // Audio Floor & Clarity
    if (clipRatio > 0.008) {
        descriptors.push("Abrasive Digital Clipping");
    }
    if (sdrDbVal < 18) {
        descriptors.push("Noisy Audio Floor");
    } else if (sdrDbVal >= 18 && sdrDbVal < 30) {
        descriptors.push("Hazy Quality");
    } else if (sdrDbVal >= 58 && clipCount === 0 && crestFactorDb >= 11) {
        descriptors.push("Pristine Clarity");
    }

    // Stereo Field
    if (isMono) {
        descriptors.push("Mono Channel");
    } else {
        if (stereoCorrelationVal < -0.20) {
            descriptors.push("Phase Inverted Width");
        } else if (stereoCorrelationVal >= -0.20 && stereoCorrelationVal < 0.10) {
            descriptors.push("Diffused Stereo Field");
        } else if (stereoCorrelationVal >= 0.10 && stereoCorrelationVal <= 0.60) {
            descriptors.push("Wide Stereo Imaging");
        } else if (stereoCorrelationVal > 0.85) {
            descriptors.push("Centered Focus");
        }
    }

    const uniqueDescriptors = Array.from(new Set(descriptors));
    return uniqueDescriptors.length > 0 ? uniqueDescriptors : ["Standard Neutral"];
}

// export function deriveAudioDescriptors0(stats: AudioStats) {
//     const descriptors = [];

//     const hasRightChannel = stats.channels > 1;
//     const sdrVal = stats.sdrVal;
//     const crestFactorDb = stats.crestFactorDb;
//     const zcrHz = stats.zcrHz;
//     const kurtosis = stats.kurtosis;
//     const rmsDb = stats.rmsDb;
//     const stereoCorrelationVal = stats.stereoCorrelationVal;
//     const clipCount = stats.clipCount;
//     const totalSamples = stats.totalSamples;


//     // Dynamic Profile & Energy
//     if (crestFactorDb > 18) descriptors.push("Dynamic");
//     if (crestFactorDb > 15 && hasRightChannel && stereoCorrelationVal <= 0.5) descriptors.push("Expansive");
//     if (crestFactorDb >= 12 && kurtosis > 1.5) descriptors.push("Lively");
//     if (crestFactorDb >= 10 && crestFactorDb < 15) descriptors.push("Punchy");
//     if (crestFactorDb >= 8 && crestFactorDb < 12 && rmsDb < -15) descriptors.push("Laid-back");
//     if (crestFactorDb >= 8 && crestFactorDb < 12 && rmsDb >= -15) descriptors.push("Balanced Energy");
//     if (crestFactorDb < 8) descriptors.push("Compressed");
//     if (crestFactorDb < 7 && rmsDb > -10) descriptors.push("Congested");
//     if (crestFactorDb < 6 && kurtosis < 0.5) descriptors.push("Flat");

//     // Pitch & Timbral Bias (ZCR)

//     if (zcrHz < 100) descriptors.push("Deep");
//     if (zcrHz >= 100 && zcrHz < 200 && crestFactorDb > 12) descriptors.push("Boomy");
//     if (zcrHz >= 100 && zcrHz < 250 && kurtosis < 1.0) descriptors.push("Bloated");
//     if (zcrHz >= 200 && zcrHz < 350) descriptors.push("Bassy");
//     if (zcrHz >= 250 && zcrHz < 500 && sdrVal !== null && (isNaN(sdrVal) || sdrVal >= 40)) descriptors.push("Warm");
//     if (zcrHz >= 300 && zcrHz < 600 && kurtosis < 0.0) descriptors.push("Dark");
//     if (zcrHz >= 500 && zcrHz <= 1200 && crestFactorDb >= 9) descriptors.push("Mellow");
//     if (zcrHz >= 800 && zcrHz <= 1800 && kurtosis >= 0.0 && kurtosis <= 2.5) descriptors.push("Balanced Tone");
//     if (zcrHz > 1800 && zcrHz <= 2800) descriptors.push("Bright");
//     if (zcrHz > 2200 && zcrHz <= 3500 && kurtosis > 2.0) descriptors.push("Crisp");
//     if (zcrHz > 2800 && zcrHz <= 4000 && kurtosis > 4.0) descriptors.push("Edgy");
//     if (zcrHz > 3500 && zcrHz <= 5000 && clipCount > 0) descriptors.push("Sharp");
//     if (zcrHz > 4500 && sdrVal !== null && (isNaN(sdrVal) || sdrVal >= 50)) descriptors.push("Airy");
//     if (zcrHz > 5000 && crestFactorDb < 9) descriptors.push("Shrill");
//     if (zcrHz > 5000 && kurtosis < 0) descriptors.push("Chilly");

//     // Transient Response & Envelope (Kurtosis)
//     if (kurtosis > 6.0 && rmsDb > -12) descriptors.push("Aggressive");
//     if (kurtosis > 5.0 && crestFactorDb > 14) descriptors.push("Impulsive");
//     if (kurtosis > 5.0 && clipCount > 0) descriptors.push("Jarring");
//     if (kurtosis > 2.5 && kurtosis <= 5.0) descriptors.push("Sharp Transients");
//     if (kurtosis >= 0.5 && kurtosis <= 2.5 && crestFactorDb >= 12) descriptors.push("Analytical");
//     if (kurtosis >= 0.0 && kurtosis < 1.0 && sdrVal !== null && (isNaN(sdrVal) || sdrVal >= 45)) descriptors.push("Precise");
//     if (kurtosis >= -0.8 && kurtosis < 0.0) descriptors.push("Smooth");
//     if (kurtosis >= -1.2 && kurtosis < -0.5 && zcrHz < 1000) descriptors.push("Soft");
//     if (kurtosis < -1.2 && crestFactorDb < 8) descriptors.push("Sustained");
//     if (kurtosis < -1.4 && rmsDb < -25) descriptors.push("Dead");

//     // Clarity, Noise Floor & Distortion
//     const clipRatio = clipCount / totalSamples;
//     if (clipRatio > 0.01) descriptors.push("Abrasive");
//     if (clipCount > 0 && clipRatio <= 0.01 && zcrHz > 2000) descriptors.push("Gritty");
//     if (clipCount > 0 && zcrHz < 500) descriptors.push("Buzzy");
//     if (clipRatio > 0.03) descriptors.push("Crude");
//     if (clipCount > 0 && clipRatio <= 0.005) descriptors.push("Grating");
//     if (clipCount > 0 && kurtosis > 3.0) descriptors.push("Edgy Distortion");
//     if (sdrVal !== null) {
//         if (!isNaN(sdrVal) && sdrVal < 20) descriptors.push("Chalky");
//         if (!isNaN(sdrVal) && sdrVal >= 20 && sdrVal < 35) descriptors.push("Hazy");
//         if (!isNaN(sdrVal) && sdrVal < 30 && kurtosis < 0) descriptors.push("Dry");
//         if (clipCount === 0 && (isNaN(sdrVal) || sdrVal >= 40) && crestFactorDb >= 10) descriptors.push("Clear");
//         if (clipCount === 0 && (isNaN(sdrVal) || sdrVal >= 50) && kurtosis > 1.5 && crestFactorDb > 12) descriptors.push("Aliveness");
//     }

//     // Stereo Field & Spatial Imaging
//     if (hasRightChannel) {
//         if (stereoCorrelationVal < -0.2) descriptors.push("Out-of-Phase Spurious");
//         else if (stereoCorrelationVal < 0.1) descriptors.push("Diffused");
//         else if (stereoCorrelationVal <= 0.3) descriptors.push("Pinched");

//         if (stereoCorrelationVal > 0.0 && stereoCorrelationVal <= 0.35 && crestFactorDb > 12) descriptors.push("Expansive Field");
//         if (stereoCorrelationVal > 0.35 && stereoCorrelationVal <= 0.75) descriptors.push("Wide Field");
//         if (stereoCorrelationVal > 0.75 && stereoCorrelationVal <= 0.88) descriptors.push("Balanced Imaging");
//         if (stereoCorrelationVal > 0.88 && stereoCorrelationVal < 0.98) descriptors.push("Centered Focus");
//         if (stereoCorrelationVal >= 0.98) descriptors.push("Boxy");
//     }

//     return descriptors.length > 0 ? descriptors : ["Neutral / Standard"];
// }
