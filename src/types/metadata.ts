export interface MetadataRow {
  label: string;
  value: string;
  color?: string | null;
  info?: string;
}

export interface MetadataResult {
  rows: MetadataRow[];
  audioDescriptors: string[];
}

export interface BasicFeatures {
  channels: number;
  duration: number;
  length: number;
  sampleRate: number;
  totalSamples: number;
  arrayShape: number[];
  memoryMb: number;
}

export interface TempoFeatures {
  bpm: number;
  confidence: number; // Normalized 0.0 to 1.0
}

export interface SpectralFeatures {
  avgCentroid: number;
  avgSpread: number;
  avgRolloff: number;
  avgFlatness: number;
  avgCrestFactor: number;
  avgSlope: number;
  avgBandEnergyRatio: number;
  avgFlux: number;
}

export interface TimeDomainFeatures {
  rmsVal: number;
  rmsDb: number;
  mavVal: number;
  peakVal: number;
  peakDb: number;
  dcOffset: number;
  crestFactorVal: number;
  crestFactorDb: number;
  zcrRatio: number;
  zcrHz: number;
  prominentBand: string;
  temporalCentroidSec: number;
  temporalCentroidNorm: number;
  energyDistributionLabel: string;
  envelopeAttackTimeSec: number;
  envelopePeakToMeanRatio: number;
  kurtosis: number;
  transientProfile: string;
  sdrVal: number | null;
  sdrDb: string;
  bitDepth: string;
  stereoCorrelationVal: number;
  stereoWidthLabel: string;
  clipCount: number;
  minVal: number;
  maxVal: number;
  totalCrossings: number;
}

export interface TimeDomainAccumulators {
  totalSamples: number;
  minVal: number;
  maxVal: number;
  maxAbsVal: number;
  peakIndex: number;
  sumSquares: number;
  sumSamples: number;
  sumAbs: number;
  sumFourth: number;
  clipCount: number;
  zeroCrossings: number;
  minNonZeroDiff: number;
  stereoDotProduct: number;
  leftSqSum: number;
  rightSqSum: number;
  weightedTimeEnergySum: number;
}

export interface AudioStats extends BasicFeatures, TempoFeatures, TimeDomainFeatures, SpectralFeatures {}

export type TargetMetricType =
  | 'peakVal'
  | 'peakDb'
  | 'rmsVal'
  | 'rmsDb'
  | 'mavVal'
  | 'crestFactorVal'
  | 'crestFactorDb'
  | 'dcOffset'
  | 'sdrDb'
  | 'peakToMeanRatio'
  | 'temporalCentroidNorm'
  | 'spectralFlatness'
  | 'spectralCrest'
  | 'bandEnergyRatio'
  | 'spectralRolloff'
  | 'clipCount'
  | 'bitDepth'
  | 'stereoCorr'
  | string;
