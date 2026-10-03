import { deriveAudioDescriptors } from '../utils/audioMetrics';
import { estimateTempo } from '../audio/tempoFeatures';
import { computeTimeDomainFeatures } from '../audio/dynamicFeatures';
import { computeSpectralFeatures } from '../audio/spectralFeatures';
import type { AudioStats, MetadataResult, MetadataRow } from '../types/metadata';
import { getScoreColor } from '../utils/metadataColors';
import { formatAudioTime, generateGaugeTicks } from '../utils/formatting';

/**
 * Loads and extracts all audio metadata asynchronously.
 */
export async function loadMetadata(
    data: Float32Array,
    buffer: AudioBuffer,
    rightData: Float32Array | null,
    onProgress?: (partialRows: MetadataRow[]) => void
): Promise<MetadataResult> {
    const rows: MetadataRow[] = [];
    const { numberOfChannels: channels, duration, sampleRate, length } = buffer;

    const totalSamples = data.length;
    const arrayShape = channels > 1 ? [channels, totalSamples] : [totalSamples];
    // const arrayShape = channels > 1 ? `[${channels}, ${totalSamples}]` : `[${totalSamples}]`;
    const memoryMb = ((totalSamples * channels * 4) / (1024 * 1024));

    // Basic Buffer Info
    rows.push({
        label: "Channels",
        value: `${channels} (${channels === 1 ? 'Mono' : 'Stereo'})`,
        info: "Number of independent audio channels. Standard tracks are 1 (Mono, centered) or 2 (Stereo, left/right spatially targeted)."
    }, {
        label: "Sample Rate",
        value: `${sampleRate.toLocaleString()} Hz`,
        info: "Number of audio snapshots taken per second. Standard CD audio is 44,100 Hz, while studio high-res is typically 48,000 Hz or 96,000 Hz."
    }, {
        label: "Duration",
        value: `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`,
        info: "Total temporal length of the audio buffer in seconds."
    }, {
        label: "Total Samples / Channel",
        value: totalSamples.toLocaleString(),
        info: "Total PCM data points stored per channel. Calculated as Sample Rate x Duration."
    }, {
        label: "Audio Tensor Shape",
        value: `[${arrayShape.toString()}]`,
        info: "Dimensional array layout of raw sample memory: [Channels, Total Samples]."
    }, {
        label: "Decoded Memory Size",
        value: `~${memoryMb.toFixed(3)} MB`,
        info: "Uncompressed RAM footprint of decoded 32-bit floating-point PCM buffers."
    });
    onProgress?.([...rows]);

    // Async Tempo & Time Domain Processing
    const [tempoStats, timeStats] = await Promise.all([
        estimateTempo(data, sampleRate),
        computeTimeDomainFeatures(data, rightData, buffer),
    ]);

    rows.push({
        label: "Estimated Tempo (BPM)",
        value: tempoStats.confidence > 0.25
            ? `~${tempoStats.bpm} BPM (${Math.round(tempoStats.confidence * 100)}% confidence)`
            : "Undetected / Ambient",
        info: "Estimated tempo calculated from rhythmic energy onsets. Standard music spans 70 BPM to 140 BPM. Confidence indicates how clear and regular the rhythmic beat grid is (high for dance/pop, low for ambient/classical)."
    });
    onProgress?.([...rows]);

    rows.push({
        label: "Estimated Bit Depth",
        value: `${timeStats.bitDepth}`,
        numericVal: parseInt(timeStats.bitDepth.match(/\d+/)?.[0] ?? '0', 10),
        color: getScoreColor(timeStats.bitDepth, 'bitDepth'),
        info: "Resolution of amplitude quantization. 16-bit PCM (step diff ~0.00003) is CD standard; 24-bit/32-bit Float offers dynamic range exceeding 120 dB. Higher is cleaner.",
        gaugeConfig: {
            min: 8,
            max: 32,
            ticks: [8, 16, 24, 32],
            zones: [
                { min: 8, max: 15.9, color: '#e74c3c' },  // Red (Low fidelity / lossy)
                { min: 15.9, max: 23.9, color: '#f1c40f' },// Yellow (16-bit CD Quality)
                { min: 23.9, max: 32, color: '#2ecc71' },  // Green (24/32-bit Studio Quality)
            ],
        },
    }, {
        label: "Min Amplitude Value",
        value: `${timeStats.minVal.toFixed(6)}`,
        info: "Lowest negative sample peak. Standard normalized range spans -1.0 to 0.0."
    }, {
        label: "Max Amplitude Value",
        value: `${timeStats.maxVal.toFixed(6)}`,
        info: "Highest positive sample peak. Standard normalized range spans 0.0 to +1.0."
    }, {
        label: "Peak Signal (dBFS)",
        value: `${timeStats.peakDb.toFixed(2)} dB`,
        numericVal: timeStats.peakDb,
        color: getScoreColor(timeStats.peakDb, 'peakDb'),
        info: "Maximum instantaneous amplitude relative to digital ceiling (0.0 dBFS). Optimal master levels rest between -1.0 dBFS and -0.3 dBFS to prevent DAC inter-sample clipping.",
        gaugeConfig: {
            min: -24,
            max: 0,
            ticks: [-24, -18, -12, -6, -1, 0],
            zones: [
                { min: -24, max: -6, color: '#e74c3c' },  // Red (Too quiet / low dynamic range)
                { min: -6, max: -1, color: '#f1c40f' },   // Yellow (Moderate)
                { min: -1, max: -0.3, color: '#2ecc71' }, // Green (Optimal)
                { min: -0.3, max: 0, color: '#e74c3c' }   // Red (Clipping risk)
            ]
        }
    }, {
        label: "RMS Energy (Linear)",
        value: `${timeStats.rmsVal.toFixed(6)}`,
        numericVal: timeStats.rmsVal,
        color: getScoreColor(timeStats.rmsVal, 'rmsVal'),
        info: "Root Mean Square linear average power (0.0 silence to 1.0 full square wave). Optimal musical density rests between 0.10 and 0.20.",
        gaugeConfig: {
            min: 0,
            max: 0.4,
            ticks: generateGaugeTicks(0, 0.4, 5),
            zones: [
                { min: 0, max: 0.05, color: '#e74c3c' },    // Red (Too quiet)
                { min: 0.05, max: 0.10, color: '#f1c40f' }, // Yellow (Moderate)
                { min: 0.10, max: 0.20, color: '#2ecc71' }, // Green (Optimal)
                { min: 0.20, max: 0.35, color: '#f1c40f' }, // Yellow (Hot)
                { min: 0.35, max: 0.40, color: '#e74c3c' }, // Red (Crushed)
            ],
        },
    }, {
        label: "RMS Power (dBFS)",
        // value: `${timeStats.rmsDb.toFixed(2)} dB (${timeStats.rmsVal.toFixed(4)})`,
        value: `${timeStats.rmsDb.toFixed(2)} dB`,
        numericVal: timeStats.rmsDb,
        color: getScoreColor(timeStats.rmsDb, 'rmsDb'),
        info: "Average perceived loudness/energy level. Range: -∞ (silence) to 0.0 dBFS. Optimal commercial audio rests between -18.0 dBFS (dynamic) and -10.0 dBFS (loud/compressed).",
        gaugeConfig: {
            min: -40,
            max: 0,
            ticks: [-40, -30, -24, -18, -10, -6, 0],
            zones: [
                { min: -40, max: -24, color: '#e74c3c' },  // Red (Too quiet)
                { min: -24, max: -18, color: '#f1c40f' },  // Yellow (Moderate)
                { min: -18, max: -10, color: '#2ecc71' },  // Green (Optimal)
                { min: -10, max: -6, color: '#f1c40f' },   // Yellow (Loud)
                { min: -6, max: 0, color: '#e74c3c' },      // Red (Overcompressed)
            ],
        },
    }, {
        label: "Dynamic Range (Crest)",
        value: `${timeStats.crestFactorDb.toFixed(2)} dB`,
        numericVal: timeStats.crestFactorDb,
        color: getScoreColor(timeStats.crestFactorDb, 'crestFactorDb'),
        info: "Peak-to-RMS ratio measuring dynamic punch. 0 dB indicates heavy brickwall limiting/square wave; >18 dB indicates high dynamic contrast (classical/orchestral). Optimal range: 10 dB to 16 dB.",
        gaugeConfig: {
            min: 0,
            max: 24,
            ticks: [0, 6, 10, 16, 20, 24],
            zones: [
                { min: 0, max: 6, color: '#e74c3c' },     // Red (Severe compression)
                { min: 6, max: 10, color: '#f1c40f' },    // Yellow (Moderate)
                { min: 10, max: 16, color: '#2ecc71' },   // Green (Optimal dynamic range)
                { min: 16, max: 20, color: '#f1c40f' },   // Yellow (High dynamics)
                { min: 20, max: 24, color: '#e74c3c' },   // Red (Uncontrolled peaks)
            ],
        },
    }, {
        label: "Signal-to-DC Ratio",
        value: `${timeStats.sdrDb} dB`,
        numericVal: timeStats.sdrVal ?? undefined,
        color: getScoreColor(timeStats.sdrVal ?? '', 'sdrDb'),
        info: "Ratio of useful AC audio power to static DC offset power. <20 dB indicates severe DC bias degradation; >60 dB indicates pristine signal purity.",
        gaugeConfig: {
            min: 0,
            max: 96,
            ticks: [0, 20, 30, 45, 60, 96],
            zones: [
                { min: 0, max: 30, color: '#e74c3c' },   // Red (High distortion)
                { min: 30, max: 60, color: '#f1c40f' },  // Yellow (Acceptable)
                { min: 60, max: 96, color: '#2ecc71' },  // Green (Pristine)
            ],
        },
    }, {
        label: "DC Offset",
        value: `${timeStats.dcOffset > 0 ? '+' : ''}${timeStats.dcOffset.toFixed(6)}`,
        numericVal: timeStats.dcOffset,
        color: getScoreColor(timeStats.dcOffset, 'dcOffset'),
        info: "Average signal deviation from zero-volt center line (-1.0 to +1.0). Non-zero values consume headroom and cause driver pop artifacts. Optimal target: 0.000000.",
        gaugeConfig: {
            min: -0.02,
            max: 0.02,
            ticks: [-0.02, -0.01, -0.001, 0, 0.001, 0.01, 0.02],
            zones: [
                { min: -0.02, max: -0.01, color: '#e74c3c' },   // Red (Severe negative shift)
                { min: -0.01, max: -0.001, color: '#f1c40f' },  // Yellow (Mild shift)
                { min: -0.001, max: 0.001, color: '#2ecc71' },  // Green (Optimal zero offset)
                { min: 0.001, max: 0.01, color: '#f1c40f' },    // Yellow (Mild shift)
                { min: 0.01, max: 0.02, color: '#e74c3c' },     // Red (Severe positive shift)
            ],
        },
    }, {
        label: "Mean Absolute Value (MAV)",
        value: `${timeStats.mavVal.toFixed(6)}`,
        numericVal: timeStats.mavVal,
        color: getScoreColor(timeStats.mavVal, 'mavVal'),
        info: "Average absolute amplitude deviation from zero (0.0 to 1.0). Reflects raw waveform area density. Optimal range: 0.08 to 0.15.",
        gaugeConfig: {
            min: 0,
            max: 0.3,
            ticks: generateGaugeTicks(0, 0.3, 6),
            zones: [
                { min: 0, max: 0.03, color: '#e74c3c' },    // Red (Very low energy)
                { min: 0.03, max: 0.08, color: '#f1c40f' }, // Yellow (Moderate)
                { min: 0.08, max: 0.15, color: '#2ecc71' }, // Green (Optimal)
                { min: 0.15, max: 0.25, color: '#f1c40f' }, // Yellow (High)
                { min: 0.25, max: 0.30, color: '#e74c3c' }, // Red (Extreme)
            ],
        },
    }, {
        label: "Avg Zero-Cross Frequency",
        value: `~${Math.round(timeStats.zcrHz)} Hz`,
        info: "Estimated fundamental frequency bias based on mean signal zero-crossing points per second. Range: 0 Hz to Nyquist (Sample Rate / 2)."
    }, {
        label: "Zero-Crossing Rate (ZCR)",
        value: `${(timeStats.zcrRatio * 100).toFixed(2)}% (${timeStats.totalCrossings.toLocaleString()} crossings)`,
        info: "Percentage of adjacent sample pairs that cross zero amplitude. Low values (<2%) indicate deep bass/sub-tones; high values (>15%) indicate bright, percussive, or noisy content."
    }, {
        label: "Temporal Centroid",
        value: `${(timeStats.temporalCentroidNorm * 100).toFixed(1)}% into timeline (at ${formatAudioTime(timeStats.temporalCentroidSec)})`,
        numericVal: timeStats.temporalCentroidNorm,
        color: getScoreColor(timeStats.temporalCentroidNorm, 'temporalCentroidNorm'),
        info: "The center of gravity of sound energy over time. <35% implies energy is front-loaded (percussive impacts/snaps); >65% implies back-loaded energy (swells/risers/fades).",
        gaugeConfig: {
            min: 0,
            max: 1.0,
            ticks: [0, 0.20, 0.35, 0.50, 0.65, 0.80, 1.0],
            zones: [
                { min: 0, max: 0.20, color: '#e74c3c' },    // Red (Front-loaded bias)
                { min: 0.20, max: 0.35, color: '#f1c40f' }, // Yellow
                { min: 0.35, max: 0.65, color: '#2ecc71' }, // Green (Balanced duration)
                { min: 0.65, max: 0.80, color: '#f1c40f' }, // Yellow
                { min: 0.80, max: 1.0, color: '#e74c3c' },  // Red (Back-loaded bias)
            ],
        },
    }, {
        label: "Energy Time Bias",
        value: timeStats.energyDistributionLabel,
        info: "Characterizes how energy is distributed across the track duration based on the temporal centroid."
    }, {
        label: "Envelope Attack Time",
        value: `${timeStats.envelopeAttackTimeSec.toFixed(3)}s`,
        info: "Time elapsed from the start of the audio file to the occurrence of the absolute maximum peak signal."
    }, {
        label: "Envelope Peak-to-Mean Ratio",
        value: `${timeStats.envelopePeakToMeanRatio.toFixed(2)}x`,
        numericVal: timeStats.envelopePeakToMeanRatio,
        color: getScoreColor(timeStats.envelopePeakToMeanRatio, 'peakToMeanRatio'),
        info: "Ratio of peak amplitude to mean absolute value (MAV). Higher ratios (>8.0x) indicate highly transient, spiky envelopes with sharp attacks.",
        gaugeConfig: {
            min: 1.0,
            max: 18.0,
            ticks: [1.0, 2.5, 3.5, 8.0, 12.0, 16.0, 18.0],
            zones: [
                { min: 1.0, max: 2.5, color: '#e74c3c' },   // Red (Flat envelope)
                { min: 2.5, max: 3.5, color: '#f1c40f' },   // Yellow
                { min: 3.5, max: 12.0, color: '#2ecc71' },  // Green (Optimal dynamics)
                { min: 12.0, max: 16.0, color: '#f1c40f' }, // Yellow
                { min: 16.0, max: 18.0, color: '#e74c3c' }, // Red (Sparse transient spikes)
            ],
        },
    }, {
        label: "Transient Profile (Kurtosis)",
        value: `${timeStats.transientProfile} (${timeStats.kurtosis.toFixed(2)})`,
        info: "Statistical sharpness of the envelope. Values < 0 indicate smooth/sustained pads; 0 to 3 indicate natural dynamics; > 5 indicates sharp percussive spikes/transients."
    }, {
        label: "Estimated Pitch / Tone Bias",
        value: timeStats.prominentBand,
        info: "Dominant frequency band derived from ZCR. Categorized as Bass (<300 Hz), Midrange (300 Hz - 2000 Hz), or Treble (>2000 Hz)."
    }, {
        label: "Stereo Image Width",
        value: `${timeStats.stereoWidthLabel}\n(Correlation: ${timeStats.stereoCorrelationVal.toFixed(2)})`,
        numericVal: timeStats.stereoCorrelationVal,
        color: rightData ? getScoreColor(timeStats.stereoCorrelationVal, 'stereoCorr') : null,
        info: "Phase agreement between left and right channels (-1.0 to +1.0). +1.0 represents mono alignment, 0.2 to 0.7 represents optimal stereo width, and negative values indicate out-of-phase cancellation.",
        gaugeConfig: {
            min: -1.0,
            max: 1.0,
            ticks: [-1.0, -0.2, 0.2, 0.5, 0.7, 1.0],
            zones: [
                { min: -1.0, max: -0.2, color: '#e74c3c' }, // Red (Phase cancellation issue)
                { min: -0.2, max: 0.2, color: '#f1c40f' },  // Yellow (Wide / uncorrelated)
                { min: 0.2, max: 0.7, color: '#2ecc71' },   // Green (Optimal stereo image)
                { min: 0.7, max: 1.0, color: '#f1c40f' },   // Yellow (Narrow / mono-heavy)
            ],
        },
    }, {
        label: "Clipped Samples",
        value: timeStats.clipCount.toLocaleString(),
        numericVal: timeStats.clipCount,
        color: getScoreColor(timeStats.clipCount, 'clipCount'),
        info: "Total samples reaching or exceeding maximum digital headroom (±0.999). 0 is optimal; >0 indicates digital overload distortion.",
        gaugeConfig: {
            min: 0,
            max: 100,
            ticks: [0, 10, 25, 50, 75, 100],
            zones: [
                { min: 0, max: 0.1, color: '#2ecc71' },   // Green (0 clips)
                { min: 0.1, max: 50, color: '#f1c40f' },  // Yellow (Minor clipping)
                { min: 50, max: 100, color: '#e74c3c' },  // Red (Severe clipping)
            ],
        },
    });
    onProgress?.([...rows]);

    // Async Spectral Processing
    const spectralStats = await computeSpectralFeatures(data, sampleRate);

    rows.push({
        label: "Spectral Centroid",
        value: `${Math.round(spectralStats.avgCentroid)} Hz`,
        info: "Center of gravity of the frequency spectrum. Higher values (> 3,000 Hz) represent brighter, treble-heavy audio, while lower values (< 1,000 Hz) represent darker, bass-heavy audio."
    }, {
        label: "Spectral Spread (Bandwidth)",
        value: `${Math.round(spectralStats.avgSpread)} Hz`,
        info: "Variance of frequencies around the Spectral Centroid. Low values (< 1,500 Hz) indicate narrow-band focused tones, while high values (> 3,500 Hz) indicate wide-band complex signals or noise."
    }, {
        label: "Spectral Roll-off (85%)",
        value: `${Math.round(spectralStats.avgRolloff)} Hz`,
        numericVal: spectralStats.avgRolloff,
        color: getScoreColor(spectralStats.avgRolloff, 'spectralRolloff'),
        info: "Frequency threshold below which 85% of total spectral energy lies. Distinguishes between muffled/dull sounds (< 2 kHz) and crisp/bright sounds (> 4 kHz).",
        gaugeConfig: {
            min: 0,
            max: 20000,
            ticks: [0, 1500, 3000, 9500, 16000, 19000, 20000],
            zones: [
                { min: 0, max: 1500, color: '#e74c3c' },       // Red (Dark / muffled)
                { min: 1500, max: 3000, color: '#f1c40f' },    // Yellow
                { min: 3000, max: 16000, color: '#2ecc71' },   // Green (Balanced spectrum)
                { min: 16000, max: 19000, color: '#f1c40f' },  // Yellow
                { min: 19000, max: 20000, color: '#e74c3c' },  // Red (Ultra-harsh treble)
            ],
        },
    }, {
        label: "Spectral Flatness",
        value: `${spectralStats.avgFlatness.toFixed(4)} (${(spectralStats.avgFlatness * 100).toFixed(1)}%)`,
        numericVal: spectralStats.avgFlatness,
        color: getScoreColor(spectralStats.avgFlatness, 'spectralFlatness'),
        info: "Ratio of geometric to arithmetic mean of the spectrum (0.0 pure tone to 1.0 white noise). Scores below 0.35 signify strong musical tonality, while values above 0.50 or 50% indicate white noise or pure percussive noise.",
        gaugeConfig: {
            min: 0,
            max: 1.0,
            ticks: [0, 0.20, 0.35, 0.60, 0.80, 1.0],
            zones: [
                { min: 0, max: 0.35, color: '#2ecc71' },  // Green (Tonal / musical)
                { min: 0.35, max: 0.60, color: '#f1c40f' },// Yellow (Semi-noisy)
                { min: 0.60, max: 1.0, color: '#e74c3c' },  // Red (White noise / broadband)
            ],
        },
    }, {
        label: "Spectral Crest Factor",
        value: `${spectralStats.avgCrestFactor.toFixed(2)}`,
        numericVal: spectralStats.avgCrestFactor,
        color: getScoreColor(spectralStats.avgCrestFactor, 'spectralCrest'),
        info: "Ratio of peak frequency bin magnitude to average magnitude. High values (> 4.0) indicate prominent tonal peaks, while low values (< 2.0) represent a flat noise floor.",
        gaugeConfig: {
            min: 1.0,
            max: 10.0,
            ticks: [1.0, 2.0, 4.0, 6.0, 8.0, 10.0],
            zones: [
                { min: 1.0, max: 2.0, color: '#e74c3c' },  // Red (Flat spectral peaks)
                { min: 2.0, max: 4.0, color: '#f1c40f' },  // Yellow
                { min: 4.0, max: 10.0, color: '#2ecc71' }, // Green (Rich resonant peaks)
            ],
        },
    }, {
        label: "Band Energy Ratio (Sub-2kHz)",
        value: `${spectralStats.avgBandEnergyRatio.toFixed(4)} (${(spectralStats.avgBandEnergyRatio * 100).toFixed(1)}%)`,
        numericVal: spectralStats.avgBandEnergyRatio,
        color: getScoreColor(spectralStats.avgBandEnergyRatio, 'bandEnergyRatio'),
        info: "Fraction of total spectral energy contained below 2 kHz. Standard music rests between 50% and 85%; extremely high values (> 90%) indicate heavy bass dominance.",
        gaugeConfig: {
            min: 0,
            max: 1.0,
            ticks: [0, 0.30, 0.50, 0.70, 0.85, 0.95, 1.0],
            zones: [
                { min: 0, max: 0.30, color: '#e74c3c' },   // Red (Weak low-mid ratio)
                { min: 0.30, max: 0.50, color: '#f1c40f' },// Yellow
                { min: 0.50, max: 0.85, color: '#2ecc71' },// Green (Optimal body balance)
                { min: 0.85, max: 0.95, color: '#f1c40f' },// Yellow
                { min: 0.95, max: 1.0, color: '#e74c3c' }, // Red (Boomy / muddy)
            ],
        },
    }, {
        label: "Spectral Slope",
        value: `${spectralStats.avgSlope.toExponential(4)}`,
        info: "Rate of spectral energy decay across increasing frequencies using linear regression. Almost always negative in natural audio as high frequencies naturally roll off, while values near 0 indicate flat energy spread across frequencies."
    }, {
        label: "Spectral Flux",
        value: `${spectralStats.avgFlux.toFixed(4)}`,
        info: "Average frame-to-frame rate of frequency change. Higher values (> 1.5) indicate fast-changing timbral activity or percussive transients, while low values (< 0.5) indicate smooth, sustained audio."
    });
    onProgress?.([...rows]);

    // 5. Extract Text Descriptor
    const allStats: AudioStats = {
        ...{ channels, duration, length, sampleRate, totalSamples, arrayShape, memoryMb },
        ...spectralStats,
        ...timeStats,
        ...tempoStats,
    };
    const audioDescriptorsStr = deriveAudioDescriptors(allStats);

    return {
        rows,
        audioDescriptors: audioDescriptorsStr
    };
}
