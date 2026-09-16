import { deriveAudioDescriptors } from '../utils/audioMetrics';
import { estimateTempo } from '../audio/tempoFeatures';
import { computeTimeDomainFeatures } from '../audio/dynamicFeatures';
import { computeSpectralFeatures } from '../audio/spectralFeatures';
import type { AudioStats, MetadataResult, MetadataRow } from '../types/metadata';
import { getScoreColor } from '../utils/metadataColors';

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
    console.log(totalSamples, length);

    // 1. Basic Buffer Info
    rows.push(
        {
            label: "Channels:",
            value: `${channels} (${channels === 1 ? 'Mono' : 'Stereo'})`,
            info: "Number of independent audio channels."
        },
        {
            label: "Sample Rate:",
            value: `${sampleRate.toLocaleString()} Hz`,
            info: "Number of audio snapshots taken per second."
        },
        {
            label: "Duration:",
            value: `${duration.toFixed(2)} seconds`,
            info: "Total length of the audio buffer in seconds."
        },
        {
            label: "Total Samples / Channel:",
            value: totalSamples.toLocaleString(),
            info: "Total PCM data points stored per channel. Calculated as Sample Rate × Duration."
        },
        {
            label: "Audio Tensor Shape:",
            value: arrayShape.toString(),
            info: "Dimensional array layout of raw sample memory: [Channels, Total Samples]."
        },
        {
            label: "Decoded Memory Size:",
            value: `~${memoryMb.toFixed(3)} MB`,
            info: "Uncompressed RAM footprint of decoded 32-bit floating-point PCM buffers."
        }
    );
    onProgress?.([...rows]);

    // 2. Async Tempo & Time Domain Processing
    const [tempoStats, timeStats] = await Promise.all([
        estimateTempo(data, sampleRate),
        computeTimeDomainFeatures(data, rightData, buffer),
    ]);

    rows.push({
        label: "Estimated Tempo (BPM):",
        value: tempoStats.confidence > 0.25
            ? `~${tempoStats.bpm} BPM (${Math.round(tempoStats.confidence * 100)}% confidence)`
            : "Undetected / Ambient",
        info: "Estimated tempo calculated from rhythmic energy onsets."
    });
    onProgress?.([...rows]);

    rows.push({
        label: "Estimated Bit Depth:",
        value: `${timeStats.bitDepth}`,
        color: getScoreColor(timeStats.bitDepth, 'bitDepth'),
        info: "Resolution of amplitude quantization."
    }, {
        label: "Min Amplitude Value:",
        value: `${timeStats.minVal.toFixed(6)}`,
        info: "Lowest negative sample peak."
    }, {
        label: "Max Amplitude Value:",
        value: `${timeStats.maxVal.toFixed(6)}`,
        info: "Highest positive sample peak."
    }, {
        label: "Peak Signal (dBFS):",
        value: `${timeStats.peakDb} dB (${timeStats.peakVal.toFixed(4)})`,
        color: getScoreColor(timeStats.peakDb, 'peakDb'),
        info: "Maximum instantaneous amplitude relative to digital ceiling."
    }, {
        label: "RMS Energy (Linear):",
        value: `${timeStats.rmsVal.toFixed(6)}`,
        info: "Root Mean Square linear average power."
    }, {
        label: "RMS Power (dBFS):",
        value: `${timeStats.rmsDb} dB (${timeStats.rmsVal.toFixed(4)})`,
        color: getScoreColor(timeStats.rmsDb, 'rmsDb'),
        info: "Average perceived loudness level."
    }, {
        label: "Dynamic Range (Crest):",
        value: `${timeStats.crestFactorDb} dB`,
        color: getScoreColor(timeStats.crestFactorDb, 'crestFactorDb'),
        info: "Peak-to-RMS ratio measuring dynamic punch."
    }, {
        label: "Signal-to-DC Ratio:",
        value: `${timeStats.sdrDb} dB`,
        color: getScoreColor(timeStats.sdrDb, 'sdrDb'),
        info: "Ratio of useful AC audio power to static DC offset power."
    }, {
        label: "DC Offset:",
        value: `${timeStats.dcOffset > 0 ? '+' : ''}${timeStats.dcOffset.toFixed(6)}`,
        color: getScoreColor(timeStats.dcOffset, 'dcOffset'),
        info: "Average signal deviation from zero-volt center line."
    }, {
        label: "Mean Absolute Value (MAV):",
        value: `${timeStats.mavVal.toFixed(6)}`,
        info: "Average absolute amplitude deviation from zero."
    }, {
        label: "Avg Zero-Cross Frequency:",
        value: `~${Math.round(timeStats.zcrHz).toLocaleString()} Hz`,
        info: "Estimated fundamental frequency bias based on mean zero-crossings."
    }, {
        label: "Zero-Crossing Rate (ZCR):",
        value: `${(timeStats.zcrRatio * 100).toFixed(2)}% (${timeStats.totalCrossings.toLocaleString()} crossings)`,
        info: "Percentage of adjacent sample pairs crossing zero."
    }, {
        label: "Temporal Centroid:",
        value: `${timeStats.temporalCentroidSec.toFixed(2)}s (${(timeStats.temporalCentroidNorm * 100).toFixed(1)}% into timeline)`,
        info: "Center of gravity of sound energy over time."
    }, {
        label: "Energy Time Bias:",
        value: timeStats.energyDistributionLabel,
        info: "Characterizes energy distribution across track duration."
    }, {
        label: "Envelope Attack Time:",
        value: `${timeStats.envelopeAttackTimeSec.toFixed(3)}s`,
        info: "Time elapsed to peak signal."
    }, {
        label: "Envelope Peak-to-Mean Ratio:",
        value: `${timeStats.envelopePeakToMeanRatio.toFixed(2)}x`,
        info: "Ratio of peak amplitude to mean absolute value."
    }, {
        label: "Transient Profile (Kurtosis):",
        value: `${timeStats.transientProfile} (${timeStats.kurtosis.toFixed(2)})`,
        info: "Statistical sharpness of the envelope."
    }, {
        label: "Estimated Pitch / Tone Bias:",
        value: timeStats.prominentBand,
        info: "Dominant frequency band derived from ZCR."
    }, {
        label: "Stereo Image Width:",
        value: `${timeStats.stereoWidthLabel} (Correlation: ${timeStats.stereoCorrelationVal.toFixed(2)})`,
        color: rightData ? getScoreColor(timeStats.stereoCorrelationVal, 'stereoCorr') : null,
        info: "Phase agreement between channels."
    }, {
        label: "Clipped Samples:",
        value: timeStats.clipCount.toLocaleString(),
        color: getScoreColor(timeStats.clipCount, 'clipCount'),
        info: "Total samples reaching digital headroom ceiling."
    });
    onProgress?.([...rows]);

    // 4. Async Spectral Processing
    const spectralStats = await computeSpectralFeatures(data, sampleRate);

    rows.push({
        label: "Spectral Centroid:",
        value: `${Math.round(spectralStats.avgCentroid)} Hz`,
        info: "Center of gravity of frequency spectrum."
    }, {
        label: "Spectral Spread (Bandwidth):",
        value: `${Math.round(spectralStats.avgSpread)} Hz`,
        info: "Variance around Spectral Centroid."
    }, {
        label: "Spectral Roll-off (85%):",
        value: `${Math.round(spectralStats.avgRolloff)} Hz`,
        color: getScoreColor(spectralStats.avgRolloff, 'spectralRolloff'),
        info: "Threshold below which 85% of total spectral energy lies."
    }, {
        label: "Spectral Flatness:",
        value: `${spectralStats.avgFlatness.toFixed(4)} (${(spectralStats.avgFlatness * 100).toFixed(1)}%)`,
        color: getScoreColor(spectralStats.avgFlatness, 'spectralFlatness'),
        info: "Tonality vs noise measure (0.0 pure tone to 1.0 white noise)."
    }, {
        label: "Spectral Crest Factor:",
        value: `${spectralStats.avgCrestFactor.toFixed(2)}`,
        info: "Ratio of peak frequency bin magnitude to average magnitude."
    }, {
        label: "Band Energy Ratio (Sub-2kHz):",
        value: `${spectralStats.avgBandEnergyRatio.toFixed(4)} (${(spectralStats.avgBandEnergyRatio * 100).toFixed(1)}%)`,
        info: "Spectral energy contained below 2 kHz."
    }, {
        label: "Spectral Slope:",
        value: `${spectralStats.avgSlope.toExponential(4)}`,
        info: "Rate of spectral energy decay using linear regression."
    }, {
        label: "Spectral Flux:",
        value: `${spectralStats.avgFlux.toFixed(4)}`,
        info: "Frame-to-frame rate of frequency change."
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
