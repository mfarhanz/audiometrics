import type { TargetMetricType } from "../types/metadata";

/**
 * Returns Hex status colors based on metric optimal ranges:
 * 🟢 Optimal: #2ecc71 | 🟡 Moderate: #f1c40f | 🔴 Warning: #e74c3c
 */
export function getScoreColor(val: number | string, metricType: TargetMetricType): string {
  if (typeof val === 'number') {
    switch (metricType) {
      case 'peakVal':
        if (val <= 0.98) return '#2ecc71';
        if (val <= 0.998) return '#f1c40f';
        return '#e74c3c';

      case 'peakDb':
        if (val >= -1.0 && val <= -0.3) return '#2ecc71';
        if (val < -1.0 && val >= -6.0) return '#f1c40f';
        return '#e74c3c';

      case 'rmsVal':
        if (val >= 0.10 && val <= 0.20) return '#2ecc71';
        if ((val >= 0.05 && val < 0.10) || (val > 0.20 && val <= 0.35)) return '#f1c40f';
        return '#e74c3c';

      case 'rmsDb':
        if (val >= -18.0 && val <= -10.0) return '#2ecc71';
        if ((val >= -24.0 && val < -18.0) || (val > -10.0 && val <= -6.0)) return '#f1c40f';
        return '#e74c3c';

      case 'mavVal':
        if (val >= 0.08 && val <= 0.15) return '#2ecc71';
        if ((val >= 0.03 && val < 0.08) || (val > 0.15 && val <= 0.25)) return '#f1c40f';
        return '#e74c3c';

      case 'crestFactorVal':
        if (val >= 3.0 && val <= 5.0) return '#2ecc71';
        if ((val >= 2.0 && val < 3.0) || (val > 5.0 && val <= 8.0)) return '#f1c40f';
        return '#e74c3c';

      case 'crestFactorDb':
        if (val >= 10.0 && val <= 16.0) return '#2ecc71';
        if ((val >= 6.0 && val < 10.0) || (val > 16.0 && val <= 20.0)) return '#f1c40f';
        return '#e74c3c';

      case 'dcOffset':
        if (Math.abs(val) < 0.001) return '#2ecc71';
        if (Math.abs(val) < 0.01) return '#f1c40f';
        return '#e74c3c';

      case 'sdrDb':
        if (val >= 60) return '#2ecc71';
        if (val >= 30) return '#f1c40f';
        return '#e74c3c';

      case 'peakToMeanRatio':
        if (val >= 3.5 && val <= 12.0) return '#2ecc71';
        if ((val >= 2.5 && val < 3.5) || (val > 12.0 && val <= 16.0)) return '#f1c40f';
        return '#e74c3c';

      case 'temporalCentroidNorm':
        if (val >= 0.35 && val <= 0.65) return '#2ecc71';
        if ((val >= 0.20 && val < 0.35) || (val > 0.65 && val <= 0.80)) return '#f1c40f';
        return '#e74c3c';

      case 'spectralFlatness':
        if (val <= 0.35) return '#2ecc71';
        if (val <= 0.60) return '#f1c40f';
        return '#e74c3c';

      case 'spectralCrest':
        if (val >= 4.0) return '#2ecc71';
        if (val >= 2.0) return '#f1c40f';
        return '#e74c3c';

      case 'bandEnergyRatio':
        if (val >= 0.50 && val <= 0.85) return '#2ecc71';
        if ((val >= 0.30 && val < 0.50) || (val > 0.85 && val <= 0.95)) return '#f1c40f';
        return '#e74c3c';

      case 'spectralRolloff':
        if (val >= 3000 && val <= 16000) return '#2ecc71';
        if ((val >= 1500 && val < 3000) || (val > 16000 && val <= 19000)) return '#f1c40f';
        return '#e74c3c';

      case 'clipCount':
        if (val === 0) return '#2ecc71';
        if (val < 50) return '#f1c40f';
        return '#e74c3c';

      case 'stereoCorr':
        if (val >= 0.2 && val <= 0.7) return '#2ecc71';
        if (val > 0.7 || (val >= -0.2 && val < 0.2)) return '#f1c40f';
        return '#e74c3c';
    }
  }

  // String evaluations
  if (typeof val === 'string' && metricType === 'bitDepth') {
    if (val.includes('24-bit') || val.includes('32-bit')) return '#2ecc71';
    if (val.includes('16-bit')) return '#f1c40f';
    return '#e74c3c';
  }

  return ''; // Default fallback for basic text metadata
}
