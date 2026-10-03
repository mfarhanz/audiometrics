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
    // TEMPO NORMALIZATION
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
    // LOW-END & BASS
    // =========================================================================
    if (avgCentroid < 650 && avgBandEnergyRatio > 0.58 && zcrHz < 120) {
        descriptors.push("Sub Bass");
    } else if (avgCentroid < 850 && avgSlope < -0.00035 && avgBandEnergyRatio > 0.50) {
        descriptors.push("Rumbling");
    } else if (avgCentroid < 1100 && avgBandEnergyRatio > 0.42) {
        descriptors.push("Deep");
    } else if (avgCentroid < 1500 && avgSlope < -0.00020 && rmsDb > -16) {
        descriptors.push("Heavy Bass");
    }

    if (zcrHz >= 80 && zcrHz < 190 && envelopePeakToMeanRatio > 5.2 && avgBandEnergyRatio > 0.35) {
        descriptors.push("Punchy");
    }
    
    if (zcrHz >= 100 && zcrHz < 240 && crestFactorDb > 11.5 && avgSpread > 2000) {
        descriptors.push("Boomy");
    }

    // =========================================================================
    // PITCH, TUNE & HARMONIC STRUCTURE
    // =========================================================================
    if (avgFlatness > 0.45 && avgCrestFactor < 2.0) {
        descriptors.push("Noisy");
    } else if (avgFlatness > 0.35 && avgCentroid > 3000 && kurtosis > 3.0) {
        descriptors.push("Unpitched Transients");
    } else if (avgFlatness < 0.05 && avgCrestFactor > 4.2) {
        descriptors.push("Pure Tone");
    } else if (avgFlatness < 0.09 && avgCrestFactor > 3.2) {
        descriptors.push("Resonant");
    } else if (avgFlatness >= 0.15 && avgFlatness <= 0.28 && avgSpread > 2500) {
        descriptors.push("Polyphonic Texture");
    }

    if (avgFlux > 0.85 && avgCrestFactor > 4.0 && avgFlatness < 0.18) {
        descriptors.push("Gliding");
    }

    if (avgSpread > 3600 && avgFlatness > 0.28 && avgFlatness < 0.45) {
        descriptors.push("Dissonant");
    }

    // =========================================================================
    // DYNAMICS & ENVELOPE
    // =========================================================================
    if (crestFactorDb > 18.5 && rmsDb < -14) {
        descriptors.push("Dynamic");
    } else if (crestFactorDb >= 13 && crestFactorDb <= 18.5 && kurtosis > 2.0) {
        descriptors.push("Lively");
    } else if (crestFactorDb < 8.0 && isVeryLoud && avgFlatness > 0.20) {
        descriptors.push("Dense");
    } else if (crestFactorDb < 9.0 && !isVeryLoud) {
        descriptors.push("Compressed");
    }

    if (temporalCentroidNorm < 0.30) {
        descriptors.push("Front-Loaded");
    } else if (temporalCentroidNorm > 0.70) {
        descriptors.push("Crescendo");
    }

    // =========================================================================
    // TIMBRE & SPECTRUM
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
        descriptors.push("Warm");
    } else if (avgCentroid < 1200 && avgRolloff < 3500) {
        descriptors.push("Dark");
    } else if (avgCentroid < 850 && avgRolloff < 2500) {
        descriptors.push("Muffled");
    }

    if (avgSpread > 4000) {
        descriptors.push("Broadband");
    } else if (avgSpread < 1100 && avgFlatness < 0.30) {
        descriptors.push("Narrowband");
    }

    // =========================================================================
    // TRANSIENTS, RHYTHM & TEMPO
    // =========================================================================
    if (kurtosis > 4.8 && envelopePeakToMeanRatio > 6.8) {
        descriptors.push("Sharp Transients");
    } else if (kurtosis > 3.8 || envelopePeakToMeanRatio > 5.8) {
        descriptors.push("Percussive");
    } else if (kurtosis < 0.25 && avgFlux < 0.25) {
        descriptors.push("Sustained");
    }

    if (tempoConfidence > 0.35 || effectiveBpm > 0) {
        if (effectiveBpm >= 142) {
            descriptors.push("Up-Tempo");
        } else if (effectiveBpm >= 100 && effectiveBpm < 142) {
            descriptors.push("Medium Tempo");
        } else if (effectiveBpm > 0 && effectiveBpm < 100) {
            descriptors.push("Down-Tempo");
        }
    }
    
    if (avgFlux < 0.18 && crestFactorDb < 8.5) {
        descriptors.push("Ambient");
    }

    // =========================================================================
    // VIBE, MOOD & GENRE
    // =========================================================================
    const energyScore = (isLoud ? 2 : 0) + (avgFlux > 0.65 ? 2 : 0) + (kurtosis > 3.5 ? 1 : 0);
    const saturationScore = clipRatio > 0.002 ? 2 : (avgFlatness > 0.22 && isLoud) ? 1 : 0;

    // Heavy / Industrial / Abrasive
    if (avgFlatness > 0.30 && kurtosis > 3.5 && saturationScore >= 1) {
        descriptors.push("Industrial");
    } else if (saturationScore >= 1 && energyScore >= 4 && effectiveBpm >= 120) {
        descriptors.push("Aggressive");
    } else if (saturationScore >= 1 && crestFactorDb > 12) {
        descriptors.push("Heavy");
    } else if (saturationScore >= 2 && avgCentroid > 3400) {
        descriptors.push("Abrasive");
    } else if (avgCentroid > 4000 && zcrHz > 2500 && isLoud) {
        descriptors.push("Piercing");
    }

    // Vibes
    if (energyScore >= 3 && effectiveBpm >= 130) {
        descriptors.push("Energetic");
    }

    if (effectiveBpm >= 112 && effectiveBpm <= 128 && (crestFactorDb > 11 || envelopePeakToMeanRatio > 5.5)) {
        descriptors.push("Groovy");
    }

    if (avgCentroid > 2500 && energyScore >= 2 && effectiveBpm >= 105 && saturationScore === 0) {
        descriptors.push("Upbeat");
    }

    if (effectiveBpm >= 75 && effectiveBpm <= 110 && avgFlux >= 0.40 && crestFactorDb < 10) {
        descriptors.push("Hypnotic");
    }

    if (!isMono && stereoCorrelationVal < 0.45 && avgSpread > 2600 && crestFactorDb > 11) {
        descriptors.push("Atmospheric");
    }

    if (temporalCentroidNorm > 0.65 && avgSpread > 3500 && crestFactorDb > 14) {
        descriptors.push("Cinematic");
    }

    if (isQuiet && avgCentroid > 3000 && kurtosis < 0.3 && !isMono) {
        descriptors.push("Ethereal");
    }

    if (avgCentroid < 1150 && energyScore <= 2 && avgBandEnergyRatio > 0.35) {
        descriptors.push("Moody");
    }

    if (avgCentroid < 800 && avgSpread > 3500 && avgFlatness > 0.25 && effectiveBpm < 100) {
        descriptors.push("Ominous");
    }

    if (crestFactorDb > 14 && saturationScore === 0 && sdrDbVal > 40 && avgSpread > 2000) {
        descriptors.push("Acoustic");
    }

    if (isQuiet && kurtosis < 0.25 && avgFlux < 0.22 && avgFlatness < 0.15) {
        descriptors.push("Meditative");
    }

    // =========================================================================
    // 7. QUALITY, TEXTURE & SPATIAL IMAGING
    // =========================================================================
    // Lo-Fi / Vintage / Gritty
    if (sdrDbVal < 32 && avgSpread < 1900 && avgRolloff < 4500) {
        descriptors.push("Lo-Fi");
    }
    
    if (sdrDbVal >= 20 && sdrDbVal <= 35 && avgRolloff < 6000 && stereoCorrelationVal > 0.5) {
        descriptors.push("Vintage");
    }

    if ((clipCount > 0 && clipRatio <= 0.003) || (saturationScore === 1 && sdrDbVal >= 32)) {
        descriptors.push("Gritty");
    }

    // Audio Floor & Clarity
    if (clipRatio > 0.008) {
        descriptors.push("Heavy Clipping");
    }
    if (sdrDbVal < 18) {
        descriptors.push("Noise Floor");
    } else if (sdrDbVal >= 18 && sdrDbVal < 30) {
        descriptors.push("Hazy Quality");
    } else if (sdrDbVal >= 58 && clipCount === 0 && crestFactorDb >= 11) {
        descriptors.push("Pristine");
    }

    // Stereo Field
    if (isMono) {
        descriptors.push("Mono");
    } else {
        if (stereoCorrelationVal < -0.20) {
            descriptors.push("Out-of-Phase");
        } else if (stereoCorrelationVal >= -0.20 && stereoCorrelationVal < 0.10) {
            descriptors.push("Diffused");
        } else if (stereoCorrelationVal >= 0.10 && stereoCorrelationVal <= 0.60) {
            descriptors.push("Wide Stereo Imaging");
        } else if (stereoCorrelationVal > 0.85) {
            descriptors.push("Centered");
        }
    }

    const uniqueDescriptors = Array.from(new Set(descriptors));
    return uniqueDescriptors.length > 0 ? uniqueDescriptors : ["Vague"];
}
