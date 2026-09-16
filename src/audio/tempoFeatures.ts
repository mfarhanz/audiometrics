import type { TempoFeatures } from '../types/metadata';
import { yieldToMain } from '../utils/thread';

/**
 * Computes RMS energy and positive onset differences.
 */
export function computeFrameEnergies(
  pcmData: Float32Array,
  frameSize = 1024,
  hopSize = 512
): { energies: Float32Array; onsets: Float32Array; numFrames: number } {
  const numFrames = Math.floor((pcmData.length - frameSize) / hopSize);
  if (numFrames < 10) {
    return {
      energies: new Float32Array(0),
      onsets: new Float32Array(0),
      numFrames: 0,
    };
  }

  const energies = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const offset = i * hopSize;
    for (let j = 0; j < frameSize; j++) {
      const val = pcmData[offset + j];
      sum += val * val;
    }
    energies[i] = Math.sqrt(sum / frameSize);
  }

  const onsets = new Float32Array(numFrames - 1);
  for (let i = 0; i < numFrames - 1; i++) {
    const diff = energies[i + 1] - energies[i];
    onsets[i] = diff > 0 ? diff : 0; // Half-wave rectification
  }

  return { energies, onsets, numFrames };
}

/**
 * Estimates BPM (Beats Per Minute) and rhythmic confidence using onset autocorrelation.
 */
export async function estimateTempo(
  pcmData: Float32Array,
  sampleRate: number,
  frameSize = 1024,
  hopSize = 512
): Promise<TempoFeatures> {
  const { onsets, numFrames } = computeFrameEnergies(pcmData, frameSize, hopSize);
  if (numFrames < 100) {
    return { bpm: 0, confidence: 0 };
  }

  const framesPerSec = sampleRate / hopSize;
  const minLag = Math.floor((60 / 180) * framesPerSec);
  const maxLag = Math.ceil((60 / 60) * framesPerSec);

  let maxCorrelation = -1;
  let bestLag = 0;

  let searchStep = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    // Yield to keep UI thread responsive during computation
    if (searchStep % 20 === 0) {
      await yieldToMain();
    }
    searchStep++;

    let correlation = 0;
    for (let i = 0; i < onsets.length - lag; i++) {
      correlation += onsets[i] * onsets[i + lag];
    }

    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag === 0) {
    return { bpm: 0, confidence: 0 };
  }

  const secondsPerBeat = bestLag / framesPerSec;
  let bpm = Math.round(60 / secondsPerBeat);

  // Normalize confidence against total onset energy
  let totalOnsetEnergy = 0;
  for (let i = 0; i < onsets.length; i++) {
    totalOnsetEnergy += onsets[i] * onsets[i];
  }

  const normalizedConfidence =
    totalOnsetEnergy > 0
      ? Math.min(1.0, maxCorrelation / totalOnsetEnergy)
      : 0;

  // Tempo octave normalization (ensures tempo stays within standard 60-180 range)
  if (bpm > 0 && bpm < 60) bpm *= 2;
  if (bpm > 180) bpm /= 2;

  return {
    bpm: Math.round(bpm),
    confidence: normalizedConfidence,
  };
}
