import type { SpectralFeatures } from '../types/metadata';
import { yieldToMain } from '../utils/thread';
import { getMagnitudeSpectrumFFT } from './fft';

/**
 * Computes averaged spectral domain features over sampled frames using FFT.
 */
export async function computeSpectralFeatures(
  data: Float32Array,
  sampleRate: number,
  frameSize = 1024,
  hopSize = 512
): Promise<SpectralFeatures> {
  let totalCentroidSum = 0;
  let totalSpreadSum = 0;
  let totalRolloffSum = 0;
  let totalFlatnessSum = 0;
  let totalCrestSum = 0;
  let totalSlopeSum = 0;
  let totalBerSum = 0;
  let totalFluxSum = 0;
  let frameCount = 0;

  let prevSpectrum: Float32Array | null = null;
  const nyquist = sampleRate / 2;
  const binWidth = nyquist / (frameSize / 2);

  // Precompute constants for slope calculation
  const numBins = frameSize / 2;
  const sumK = (numBins * (numBins - 1)) / 2;
  const sumKSq = (numBins * (numBins - 1) * (2 * numBins - 1)) / 6;
  const slopeDenominator = numBins * sumKSq - sumK * sumK;

  const maxFramesToAnalyze = 300;
  const step = Math.max(
    1,
    Math.floor((data.length - frameSize) / (hopSize * maxFramesToAnalyze))
  );

  let processedCount = 0;

  for (let i = 0; i <= data.length - frameSize; i += hopSize * step) {
    // Yield to main thread every 50 frames to maintain 60 FPS UI responsiveness
    if (processedCount > 0 && processedCount % 50 === 0) {
      await yieldToMain();
    }
    processedCount++;

    const frame = data.subarray(i, i + frameSize);
    const spectrum = getMagnitudeSpectrumFFT(frame, frameSize);

    let totalMag = 0;
    let weightedSum = 0;
    let maxMag = 0;
    let logSum = 0;
    let lowBandEnergy = 0;
    let totalEnergy = 0;
    let sumKMag = 0;

    const lowBandCutoffBin = Math.min(numBins, Math.floor(2000 / binWidth)); // 2 kHz boundary

    // Single pass iteration across frequency bins
    for (let k = 0; k < numBins; k++) {
      const mag = spectrum[k];
      const freq = k * binWidth;
      const magSq = mag * mag;

      totalMag += mag;
      weightedSum += freq * mag;
      totalEnergy += magSq;
      sumKMag += k * mag;

      if (mag > maxMag) maxMag = mag;

      logSum += Math.log(mag + 1e-12);

      if (k <= lowBandCutoffBin) {
        lowBandEnergy += magSq;
      }
    }

    // Process valid non-silent frames
    if (totalMag > 1e-6) {
      frameCount++;

      // 1. Spectral Centroid
      const centroid = weightedSum / totalMag;
      totalCentroidSum += centroid;

      // 2. Spectral Bandwidth / Spread
      let varianceSum = 0;
      for (let k = 0; k < numBins; k++) {
        const freq = k * binWidth;
        const diff = freq - centroid;
        varianceSum += diff * diff * spectrum[k];
      }
      const bandwidth = Math.sqrt(varianceSum / totalMag);
      totalSpreadSum += bandwidth;

      // 3. Spectral Roll-off (85% energy point)
      const rolloffThreshold = totalMag * 0.85;
      let cumSum = 0;
      let rolloffFreq = nyquist;
      for (let k = 0; k < numBins; k++) {
        cumSum += spectrum[k];
        if (cumSum >= rolloffThreshold) {
          rolloffFreq = k * binWidth;
          break;
        }
      }
      totalRolloffSum += rolloffFreq;

      // 4. Spectral Flatness
      const arithmeticMean = totalMag / numBins;
      const geometricMean = Math.exp(logSum / numBins);
      const flatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
      totalFlatnessSum += flatness;

      // 5. Spectral Crest Factor
      const crest = arithmeticMean > 0 ? maxMag / arithmeticMean : 0;
      totalCrestSum += crest;

      // 6. Band Energy Ratio (BER)
      const ber = totalEnergy > 0 ? lowBandEnergy / totalEnergy : 0;
      totalBerSum += ber;

      // 7. Spectral Slope
      const slopeNumerator = numBins * sumKMag - sumK * totalMag;
      const slope = slopeDenominator !== 0 ? slopeNumerator / slopeDenominator : 0;
      totalSlopeSum += slope;

      // 8. Spectral Flux
      if (prevSpectrum) {
        let flux = 0;
        for (let k = 0; k < numBins; k++) {
          const diff = spectrum[k] - prevSpectrum[k];
          if (diff > 0) flux += diff;
        }
        totalFluxSum += flux;
      }

      prevSpectrum = spectrum;
    }
  }

  const validFrames = frameCount > 0 ? frameCount : 1;

  return {
    avgCentroid: totalCentroidSum / validFrames,
    avgSpread: totalSpreadSum / validFrames,
    avgRolloff: totalRolloffSum / validFrames,
    avgFlatness: totalFlatnessSum / validFrames,
    avgCrestFactor: totalCrestSum / validFrames,
    avgSlope: totalSlopeSum / validFrames,
    avgBandEnergyRatio: totalBerSum / validFrames,
    avgFlux: frameCount > 1 ? totalFluxSum / (frameCount - 1) : 0,
  };
}
