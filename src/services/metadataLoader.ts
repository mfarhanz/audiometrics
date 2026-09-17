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
            info: "Number of independent audio channels. Standard tracks are 1 (Mono, centered) or 2 (Stereo, left/right spatially targeted)."
        },
        {
            label: "Sample Rate:",
            value: `${sampleRate.toLocaleString()} Hz`,
            info: "Number of audio snapshots taken per second. Standard CD audio is 44,100 Hz, while studio high-res is typically 48,000 Hz or 96,000 Hz."
        },
        {
            label: "Duration:",
            value: `${duration.toFixed(2)} seconds`,
            info: "Total temporal length of the audio buffer in seconds."
        },
        {
            label: "Total Samples / Channel:",
            value: totalSamples.toLocaleString(),
            info: "Total PCM data points stored per channel. Calculated as Sample Rate x Duration."
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
        info: "Estimated tempo calculated from rhythmic energy onsets. Standard music spans 70 BPM to 140 BPM. Confidence indicates how clear and regular the rhythmic beat grid is (high for dance/pop, low for ambient/classical)."
    });
    onProgress?.([...rows]);

    rows.push({
        label: "Estimated Bit Depth:",
        value: `${timeStats.bitDepth}`,
        color: getScoreColor(timeStats.bitDepth, 'bitDepth'),
        info: "Resolution of amplitude quantization. 16-bit PCM (step diff ~0.00003) is CD standard; 24-bit/32-bit Float offers dynamic range exceeding 120 dB. Higher is cleaner."
    }, {
        label: "Min Amplitude Value:",
        value: `${timeStats.minVal.toFixed(6)}`,
        info: "Lowest negative sample peak. Standard normalized range spans -1.0 to 0.0."
    }, {
        label: "Max Amplitude Value:",
        value: `${timeStats.maxVal.toFixed(6)}`,
        info: "Highest positive sample peak. Standard normalized range spans 0.0 to +1.0."
    }, {
        label: "Peak Signal (dBFS):",
        value: `${timeStats.peakDb} dB (${timeStats.peakVal.toFixed(4)})`,
        color: getScoreColor(timeStats.peakDb, 'peakDb'),
        info: "Maximum instantaneous amplitude relative to digital ceiling (0.0 dBFS). Optimal master levels rest between -1.0 dBFS and -0.3 dBFS to prevent DAC inter-sample clipping."
    }, {
        label: "RMS Energy (Linear):",
        value: `${timeStats.rmsVal.toFixed(6)}`,
        color: getScoreColor(timeStats.rmsVal, 'rmsVal'),
        info: "Root Mean Square linear average power (0.0 silence to 1.0 full square wave). Optimal musical density rests between 0.10 and 0.20."
    }, {
        label: "RMS Power (dBFS):",
        value: `${timeStats.rmsDb} dB (${timeStats.rmsVal.toFixed(4)})`,
        color: getScoreColor(timeStats.rmsDb, 'rmsDb'),
        info: "Average perceived loudness/energy level. Range: -∞ (silence) to 0.0 dBFS. Optimal commercial audio rests between -18.0 dBFS (dynamic) and -10.0 dBFS (loud/compressed)."
    }, {
        label: "Dynamic Range (Crest):",
        value: `${timeStats.crestFactorDb} dB`,
        color: getScoreColor(timeStats.crestFactorDb, 'crestFactorDb'),
        info: "Peak-to-RMS ratio measuring dynamic punch. 0 dB indicates heavy brickwall limiting/square wave; >18 dB indicates high dynamic contrast (classical/orchestral). Optimal range: 10 dB to 16 dB."
    }, {
        label: "Signal-to-DC Ratio:",
        value: `${timeStats.sdrDb} dB`,
        color: getScoreColor(timeStats.sdrDb, 'sdrDb'),
        info: "Ratio of useful AC audio power to static DC offset power. <20 dB indicates severe DC bias degradation; >60 dB indicates pristine signal purity."
    }, {
        label: "DC Offset:",
        value: `${timeStats.dcOffset > 0 ? '+' : ''}${timeStats.dcOffset.toFixed(6)}`,
        color: getScoreColor(timeStats.dcOffset, 'dcOffset'),
        info: "Average signal deviation from zero-volt center line (-1.0 to +1.0). Non-zero values consume headroom and cause driver pop artifacts. Optimal target: 0.000000."
    }, {
        label: "Mean Absolute Value (MAV):",
        value: `${timeStats.mavVal.toFixed(6)}`,
        color: getScoreColor(timeStats.mavVal, 'mavVal'),
        info: "Average absolute amplitude deviation from zero (0.0 to 1.0). Reflects raw waveform area density. Optimal range: 0.08 to 0.15."
    }, {
        label: "Avg Zero-Cross Frequency:",
        value: `~${Math.round(timeStats.zcrHz).toLocaleString()} Hz`,
        info: "Estimated fundamental frequency bias based on mean signal zero-crossing points per second. Range: 0 Hz to Nyquist (Sample Rate / 2)."
    }, {
        label: "Zero-Crossing Rate (ZCR):",
        value: `${(timeStats.zcrRatio * 100).toFixed(2)}% (${timeStats.totalCrossings.toLocaleString()} crossings)`,
        info: "Percentage of adjacent sample pairs that cross zero amplitude. Low values (<2%) indicate deep bass/sub-tones; high values (>15%) indicate bright, percussive, or noisy content."
    }, {
        label: "Temporal Centroid:",
        value: `${timeStats.temporalCentroidSec.toFixed(2)}s (${(timeStats.temporalCentroidNorm * 100).toFixed(1)}% into timeline)`,
        color: getScoreColor(timeStats.temporalCentroidNorm, 'temporalCentroidNorm'),
        info: "The center of gravity of sound energy over time. <35% implies energy is front-loaded (percussive impacts/snaps); >65% implies back-loaded energy (swells/risers/fades)."
    }, {
        label: "Energy Time Bias:",
        value: timeStats.energyDistributionLabel,
        info: "Characterizes how energy is distributed across the track duration based on the temporal centroid."
    }, {
        label: "Envelope Attack Time:",
        value: `${timeStats.envelopeAttackTimeSec.toFixed(3)}s`,
        info: "Time elapsed from the start of the audio file to the occurrence of the absolute maximum peak signal."
    }, {
        label: "Envelope Peak-to-Mean Ratio:",
        value: `${timeStats.envelopePeakToMeanRatio.toFixed(2)}x`,
        color: getScoreColor(timeStats.envelopePeakToMeanRatio, 'peakToMeanRatio'),
        info: "Ratio of peak amplitude to mean absolute value (MAV). Higher ratios (>8.0x) indicate highly transient, spiky envelopes with sharp attacks."
    }, {
        label: "Transient Profile (Kurtosis):",
        value: `${timeStats.transientProfile} (${timeStats.kurtosis.toFixed(2)})`,
        info: "Statistical sharpness of the envelope. Values < 0 indicate smooth/sustained pads; 0 to 3 indicate natural dynamics; > 5 indicates sharp percussive spikes/transients."
    }, {
        label: "Estimated Pitch / Tone Bias:",
        value: timeStats.prominentBand,
        info: "Dominant frequency band derived from ZCR. Categorized as Bass (<300 Hz), Midrange (300 Hz - 2000 Hz), or Treble (>2000 Hz)."
    }, {
        label: "Stereo Image Width:",
        value: `${timeStats.stereoWidthLabel} (Correlation: ${timeStats.stereoCorrelationVal.toFixed(2)})`,
        color: rightData ? getScoreColor(timeStats.stereoCorrelationVal, 'stereoCorr') : null,
        info: "Phase agreement between left and right channels (-1.0 to +1.0). +1.0 represents mono alignment, 0.2 to 0.7 represents optimal stereo width, and negative values indicate out-of-phase cancellation."
    }, {
        label: "Clipped Samples:",
        value: timeStats.clipCount.toLocaleString(),
        color: getScoreColor(timeStats.clipCount, 'clipCount'),
        info: "Total samples reaching or exceeding maximum digital headroom (±0.999). 0 is optimal; >0 indicates digital overload distortion."
    });
    onProgress?.([...rows]);

    // 4. Async Spectral Processing
    const spectralStats = await computeSpectralFeatures(data, sampleRate);

    rows.push({
        label: "Spectral Centroid:",
        value: `${Math.round(spectralStats.avgCentroid)} Hz`,
        info: "Center of gravity of the frequency spectrum. Higher values (> 3,000 Hz) represent brighter, treble-heavy audio, while lower values (< 1,000 Hz) represent darker, bass-heavy audio."
    }, {
        label: "Spectral Spread (Bandwidth):",
        value: `${Math.round(spectralStats.avgSpread)} Hz`,
        info: "Variance of frequencies around the Spectral Centroid. Low values (< 1,500 Hz) indicate narrow-band focused tones, while high values (> 3,500 Hz) indicate wide-band complex signals or noise."
    }, {
        label: "Spectral Roll-off (85%):",
        value: `${Math.round(spectralStats.avgRolloff)} Hz`,
        color: getScoreColor(spectralStats.avgRolloff, 'spectralRolloff'),
        info: "Frequency threshold below which 85% of total spectral energy lies. Distinguishes between muffled/dull sounds (< 2 kHz) and crisp/bright sounds (> 4 kHz)."
    }, {
        label: "Spectral Flatness:",
        value: `${spectralStats.avgFlatness.toFixed(4)} (${(spectralStats.avgFlatness * 100).toFixed(1)}%)`,
        color: getScoreColor(spectralStats.avgFlatness, 'spectralFlatness'),
        info: "Ratio of geometric to arithmetic mean of the spectrum (0.0 pure tone to 1.0 white noise). Scores below 0.35 signify strong musical tonality, while values above 0.50 or 50% indicate white noise or pure percussive noise."
    }, {
        label: "Spectral Crest Factor:",
        value: `${spectralStats.avgCrestFactor.toFixed(2)}`,
        color: getScoreColor(spectralStats.avgCrestFactor, 'spectralCrest'),
        info: "Ratio of peak frequency bin magnitude to average magnitude. High values (> 4.0) indicate prominent tonal peaks, while low values (< 2.0) represent a flat noise floor."
    }, {
        label: "Band Energy Ratio (Sub-2kHz):",
        value: `${spectralStats.avgBandEnergyRatio.toFixed(4)} (${(spectralStats.avgBandEnergyRatio * 100).toFixed(1)}%)`,
        color: getScoreColor(spectralStats.avgBandEnergyRatio, 'bandEnergyRatio'),
        info: "Fraction of total spectral energy contained below 2 kHz. Standard music rests between 50% and 85%; extremely high values (> 90%) indicate heavy bass dominance."
    }, {
        label: "Spectral Slope:",
        value: `${spectralStats.avgSlope.toExponential(4)}`,
        info: "Rate of spectral energy decay across increasing frequencies using linear regression. Almost always negative in natural audio as high frequencies naturally roll off, while values near 0 indicate flat energy spread across frequencies."
    }, {
        label: "Spectral Flux:",
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
