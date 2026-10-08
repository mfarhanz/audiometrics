import type { SPECTRUM_BAR_STYLES, WINDOW_SIZES } from "../data/constants";

export type VisualizerMode = 'oscilloscope' | 'spectrum';

export type PrimaryChannel = 'left' | 'right';

export type SpectrumBarStyle = typeof SPECTRUM_BAR_STYLES[number];

export type WindowSize = typeof WINDOW_SIZES[number];

export interface VisualizerConfig {
    windowSize: WindowSize;
    sampleSkip: number;
    thickness: number;
    smoothing?: boolean;
    secondaryOpacity: number;
    frequencyCount: number;
    barGap: number;
    barDensity: number;
    oscBg: string;
    specBg: string;
    waveBg: string;
    waveSecondaryBg: string;
    lineGlow: string;
    barColors: string[];
    barStyle?: SpectrumBarStyle;
    showGrid?: boolean;
    gridColor?: string;
    gridDivisionsX?: number;
    gridDivisionsY?: number;
    gridSubdivisions?: number;
    primaryBlendMode?: GlobalCompositeOperation;
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

export interface GaugeZone {
    min: number;
    max: number;
    color: string; // Green (#2ecc71), Yellow (#f1c40f), Red (#e74c3c)
}
