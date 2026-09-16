export type VisualizerMode = 'oscilloscope' | 'spectrum';
export type PrimaryChannel = 'left' | 'right';

export interface VisualizerConfig {
  windowSize: number;
  sampleSkip: number;
  thickness: number;
  secondaryOpacity: number;
  frequencyCount: number;
  barGap: number;
  barFrequency: number;
  oscBg: string;
  specBg: string;
  waveformBg: string;
  waveformSecondaryBg: string;
  lineGlow: string;
  barColors: string[];
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mode: VisualizerMode;
  config: VisualizerConfig;
  currentIndex: number;
  totalSamples: number;
  primaryChannel: PrimaryChannel;
  leftChannel: Float32Array | null;
  rightChannel: Float32Array | null;
  analyserNode: AnalyserNode | null;
  frequencyData: Uint8Array<ArrayBuffer> | null;
  isPlaying: boolean;
}
