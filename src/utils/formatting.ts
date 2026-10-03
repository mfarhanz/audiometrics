export function formatAudioTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00.000';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  // Pad numbers to ensure fixed width formatting (e.g., mm:ss.mmm)
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const ms = String(milliseconds).padStart(3, '0');

  return `${mm}:${ss}.${ms}`;
}

/**
 * Generates N clean, rounded tick marks between min and max.
 */
export function generateGaugeTicks(min: number, max: number, count: number = 6): number[] {
  const step = (max - min) / (count - 1);
  const ticks: number[] = [];
  
  for (let i = 0; i < count; i++) {
    const val = min + step * i;
    // Format to max 2 decimal places to keep labels clean
    const formatted = Math.abs(val) < 1 ? Number(val.toFixed(2)) : Math.round(val);
    ticks.push(formatted);
  }
  
  return Array.from(new Set(ticks)); // Deduplicate edge cases
}
