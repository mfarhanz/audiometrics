import type { TimeDomainAccumulators, TimeDomainFeatures } from '../types/metadata';
import { yieldToMain } from '../utils/thread';

/**
 * Computes single-pass time-domain statistical accumulators.
 */
export async function getTimeDomainStatistics(
    data: Float32Array,
    rightData: Float32Array | null,
    sampleRate: number
): Promise<TimeDomainAccumulators> {
    const totalSamples = data.length;
    if (totalSamples === 0) {
        return {
            totalSamples: 0,
            minVal: 0,
            maxVal: 0,
            maxAbsVal: 0,
            peakIndex: 0,
            sumSquares: 0,
            sumSamples: 0,
            sumAbs: 0,
            sumFourth: 0,
            clipCount: 0,
            zeroCrossings: 0,
            minNonZeroDiff: Infinity,
            stereoDotProduct: 0,
            leftSqSum: 0,
            rightSqSum: 0,
            weightedTimeEnergySum: 0,
        };
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    let minNonZeroDiff = Infinity;
    let sumSquares = 0;
    let sumSamples = 0;
    let sumAbs = 0;
    let sumFourth = 0;
    let clipCount = 0;
    let zeroCrossings = 0;
    let stereoDotProduct = 0;
    let leftSqSum = 0;
    let rightSqSum = 0;
    let prevMonoVal = 0;
    let peakIndex = 0;
    let maxAbsVal = 0;
    let weightedTimeEnergySum = 0;

    const chunkSize = 100000; // Yield to main thread every 100k samples

    for (let i = 0; i < totalSamples; i++) {
        if (i > 0 && i % chunkSize === 0) {
            await yieldToMain();
        }

        const lVal = data[i];
        let val: number;

        if (rightData) {
            const rVal = rightData[i];
            val = (lVal + rVal) * 0.5; // Downmix to mono for global time metrics
            stereoDotProduct += lVal * rVal;
            leftSqSum += lVal * lVal;
            rightSqSum += rVal * rVal;
        } else {
            val = lVal;
        }

        const absVal = Math.abs(val);
        const square = val * val;

        sumSquares += square;
        sumFourth += square * square;
        sumSamples += val;
        sumAbs += absVal;

        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;

        if (absVal >= 0.999) {
            clipCount++;
        }

        if (absVal > maxAbsVal) {
            maxAbsVal = absVal;
            peakIndex = i;
        }

        const sampleTime = i / sampleRate;
        weightedTimeEnergySum += sampleTime * square;

        if (i > 0) {
            if ((val >= 0 && prevMonoVal < 0) || (val < 0 && prevMonoVal >= 0)) {
                zeroCrossings++;
            }

            const diff = Math.abs(val - prevMonoVal);
            if (diff > 0.0000001 && diff < minNonZeroDiff) {
                minNonZeroDiff = diff;
            }
        }

        prevMonoVal = val;
    }

    return {
        totalSamples,
        minVal,
        maxVal,
        maxAbsVal,
        peakIndex,
        sumSquares,
        sumSamples,
        sumAbs,
        sumFourth,
        clipCount,
        zeroCrossings,
        minNonZeroDiff,
        stereoDotProduct,
        leftSqSum,
        rightSqSum,
        weightedTimeEnergySum,
    };
}

/**
 * Calculates raw time-domain features into structured metric objects.
 */
export async function computeTimeDomainFeatures(
    data: Float32Array,
    rightData: Float32Array | null,
    buffer: AudioBuffer
): Promise<TimeDomainFeatures> {
    const duration = buffer.duration;
    const sampleRate = buffer.sampleRate;

    // Run single-pass accumulators
    const timeStats = await getTimeDomainStatistics(data, rightData, sampleRate);

    const totalSamples = timeStats.totalSamples;

    // RMS & Power
    const rmsVal = Math.sqrt(timeStats.sumSquares / totalSamples);
    const rmsDb = rmsVal > 0 ? 20 * Math.log10(rmsVal) : -Infinity;
    // const rmsDb = rmsVal > 0 ? rmsDbNum.toFixed(2) : '-∞';

    // MAV & Peak
    const mavVal = timeStats.sumAbs / totalSamples;
    const peakVal = Math.max(Math.abs(timeStats.minVal), Math.abs(timeStats.maxVal));
    // const peakDb = peakVal > 0 ? (20 * Math.log10(peakVal)).toFixed(2) : '-∞';
    const peakDb = peakVal > 0 ? (20 * Math.log10(peakVal)) : -Infinity;

    // DC Offset & Crest Factor
    const dcOffset = timeStats.sumSamples / totalSamples;
    const crestFactorVal = rmsVal > 0 ? (peakVal / rmsVal) : 0;
    const crestFactorDb = crestFactorVal > 0 ? 20 * Math.log10(crestFactorVal) : 0;
    // const crestFactorDb = crestFactorDbNum.toFixed(2);

    // Zero-Crossing
    const zcrRatio = timeStats.zeroCrossings / (totalSamples - 1);
    const zcrHz = (timeStats.zeroCrossings / duration) / 2;
    const prominentBand = `~${Math.round(zcrHz).toLocaleString()} Hz (${zcrHz < 300 ? 'Bass' : zcrHz > 2000 ? 'Treble' : 'Midrange'})`;

    // Temporal Centroid
    const temporalCentroidSec = timeStats.sumSquares > 0 ? (timeStats.weightedTimeEnergySum / timeStats.sumSquares) : (duration / 2);
    const temporalCentroidNorm = duration > 0 ? (temporalCentroidSec / duration) : 0.5;
    let energyDistributionLabel = "Centered / Uniform";
    if (temporalCentroidNorm < 0.35) energyDistributionLabel = "Front-Loaded (Early Impact / Fast Attack)";
    else if (temporalCentroidNorm > 0.65) energyDistributionLabel = "Back-Loaded (Late Build-up / Swell)";

    // Kurtosis & Envelopes
    const envelopeAttackTimeSec = timeStats.peakIndex / sampleRate;
    const envelopePeakToMeanRatio = mavVal > 0 ? (timeStats.maxAbsVal / mavVal) : 0;
    const meanSquare = timeStats.sumSquares / totalSamples;
    const meanFourth = timeStats.sumFourth / totalSamples;
    const kurtosis = meanSquare > 0 ? (meanFourth / (meanSquare * meanSquare)) - 3 : 0;
    let transientProfile = "Sustained / Smooth";
    if (kurtosis > 3.0) transientProfile = "Highly Percussive / Spiky";
    else if (kurtosis > 1.0) transientProfile = "Moderate Transients";

    // Signal-to-DC Ratio
    const dcPower = dcOffset * dcOffset;
    const signalPower = meanSquare - dcPower;
    const sdrVal = (dcPower > 0 && signalPower > 0) ? (10 * Math.log10(signalPower / dcPower)) : null;
    const sdrDb = sdrVal !== null ? sdrVal.toFixed(1) : '> 60'; // use sdrVal for calculations

    // Bit Depth Estimation
    let bitDepth = "32-bit Float";
    if (timeStats.minNonZeroDiff >= 0.003) bitDepth = "8-bit PCM";
    else if (timeStats.minNonZeroDiff >= 0.00002) bitDepth = "16-bit PCM (CD Quality)";
    else if (timeStats.minNonZeroDiff >= 0.0000001) bitDepth = "24-bit PCM (Hi-Res)";

    // Stereo Alignment
    let stereoCorrelationVal = 1.0;
    let stereoWidthLabel = "Centered / Mono";
    if (rightData && timeStats.leftSqSum > 0 && timeStats.rightSqSum > 0) {
        stereoCorrelationVal = timeStats.stereoDotProduct / (Math.sqrt(timeStats.leftSqSum) * Math.sqrt(timeStats.rightSqSum));
        if (stereoCorrelationVal > 0.85) stereoWidthLabel = "Narrow / Centered";
        else if (stereoCorrelationVal > 0.3) stereoWidthLabel = "Wide / Expansive";
        else if (stereoCorrelationVal >= -0.2) stereoWidthLabel = "Very Wide / Ambient";
        else stereoWidthLabel = "Out of Phase / Spurious";
    }

    return {
        rmsVal, 
        rmsDb, 
        mavVal, 
        peakVal, 
        peakDb,
        dcOffset, 
        crestFactorVal, 
        crestFactorDb,
        zcrRatio, 
        zcrHz, 
        prominentBand, 
        temporalCentroidSec, 
        temporalCentroidNorm,
        energyDistributionLabel, 
        envelopeAttackTimeSec, 
        envelopePeakToMeanRatio, 
        kurtosis,
        transientProfile, 
        sdrVal, 
        sdrDb, 
        bitDepth, 
        stereoCorrelationVal, 
        stereoWidthLabel,
        clipCount: timeStats.clipCount,
        minVal: timeStats.minVal,
        maxVal: timeStats.maxVal,
        totalCrossings: timeStats.zeroCrossings
    };
}
