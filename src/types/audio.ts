import type { PrimaryChannel } from "./visualizer";

export interface AudioFileInfo {
  name: string;
  sizeMb: string;
}

export interface AudioEngineState {
  isPlaying: boolean;
  currentIndex: number;
  sampleRate: number;
  duration: number;
  totalSamples: number;
  fileName: string | null;
  fileSizeMb: number | null;
  hasStereo: boolean;
  primaryChannel: PrimaryChannel;
}

export interface FFTCache {
  frameSize: number;
  hanningWindow: Float32Array | null;
  bitRevTable: Uint32Array | null;
  cosTable: Float32Array | null;
  sinTable: Float32Array | null;
}
