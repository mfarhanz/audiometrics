import type { FFTCache } from "../types/audio";

const fftCache: FFTCache = {
    frameSize: 0,
    hanningWindow: null,
    bitRevTable: null,
    cosTable: null,
    sinTable: null,
};

/**
 * Initializes look-up tables for Hanning window, bit-reversal sorting, and twiddle factors.
 * Executes only when frameSize changes.
 */
export function initFFTCache(N: number): void {
    if (fftCache.frameSize === N) return;

    fftCache.frameSize = N;
    fftCache.hanningWindow = new Float32Array(N);
    fftCache.bitRevTable = new Uint32Array(N);
    fftCache.cosTable = new Float32Array(N / 2);
    fftCache.sinTable = new Float32Array(N / 2);

    // 1. Precompute Hanning Window
    for (let i = 0; i < N; i++) {
        fftCache.hanningWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }

    // 2. Precompute Bit-Reversal Table
    const numBits = Math.log2(N);
    for (let i = 0; i < N; i++) {
        let rev = 0;
        for (let j = 0; j < numBits; j++) {
            if ((i >> j) & 1) {
                rev |= 1 << (numBits - 1 - j);
            }
        }
        fftCache.bitRevTable[i] = rev;
    }

    // 3. Precompute Twiddle Factors
    const halfN = N / 2;
    for (let i = 0; i < halfN; i++) {
        const angle = (2 * Math.PI * i) / N;
        fftCache.cosTable[i] = Math.cos(angle);
        fftCache.sinTable[i] = Math.sin(angle);
    }
}

/**
 * Computes the real magnitude spectrum using an in-place O(N log N) Radix-2 FFT.
 */
export function getMagnitudeSpectrumFFT(frame: Float32Array, N: number): Float32Array {
    initFFTCache(N);

    const halfN = N / 2;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    const magnitudes = new Float32Array(halfN);

    const win = fftCache.hanningWindow!;
    const bitRev = fftCache.bitRevTable!;
    const cosTab = fftCache.cosTable!;
    const sinTab = fftCache.sinTable!;

    // Apply window and bit-reversal sorting step
    for (let i = 0; i < N; i++) {
        const rev = bitRev[i];
        real[rev] = frame[i] * win[i];
        imag[rev] = 0;
    }

    // Cooley-Tukey Radix-2 In-Place FFT
    for (let len = 2; len <= N; len <<= 1) {
        const halfLen = len >> 1;
        const step = N / len;

        for (let i = 0; i < N; i += len) {
            for (let j = 0; j < halfLen; j++) {
                const k = j * step;
                const c = cosTab[k];
                const s = sinTab[k];

                const reEven = real[i + j];
                const imEven = imag[i + j];
                const reOdd = real[i + j + halfLen];
                const imOdd = imag[i + j + halfLen];

                // Complex multiplication
                const tr = c * reOdd + s * imOdd;
                const ti = c * imOdd - s * reOdd;

                real[i + j] = reEven + tr;
                imag[i + j] = imEven + ti;
                real[i + j + halfLen] = reEven - tr;
                imag[i + j + halfLen] = imEven - ti;
            }
        }
    }

    // Extract real magnitude spectrum for positive frequency bins
    for (let k = 0; k < halfN; k++) {
        const re = real[k];
        const im = imag[k];
        magnitudes[k] = Math.sqrt(re * re + im * im);
    }

    return magnitudes;
}