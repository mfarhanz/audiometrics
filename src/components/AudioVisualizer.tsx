import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { VisualizerConfig, VisualizerMode, PrimaryChannel, RenderContext } from '../types/visualizer';
import type { MetadataRow } from '../types/metadata';
import type { AudioFileInfo } from '../types/audio';
import { MetadataDisplay } from './MetadataDisplay';
import { PaletteManager } from './PaletteManager';
import { drawOscilloscopeFrame, drawSpectrumFrame } from '../utils/canvasRenderers';
import { loadMetadata } from '../services/metadataLoader';
import { WINDOW_SIZE_STEPS } from '../constants/window';

export const AudioVisualizer: React.FC = () => {
    // Mode & Drawer State (Replaces classList.toggle)
    const [mode, setMode] = useState<VisualizerMode>('oscilloscope');
    const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
    const [isMetaOpen, setIsMetaOpen] = useState<boolean>(true);

    // Audio Processing State
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isAudioLoaded, setIsAudioLoaded] = useState<boolean>(false);
    const [isStereo, setIsStereo] = useState<boolean>(false);
    const [primaryChannel, setPrimaryChannel] = useState<PrimaryChannel>('left');
    const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);

    // Metadata Display State
    // const [metadata, setMetadata] = useState<MetadataRecord | null>(null);
    const [metaPlaceholder, setMetaPlaceholder] = useState<string>('');
    const [metadataRows, setMetadataRows] = useState<MetadataRow[]>([]);
    const [progressText, setProgressText] = useState<string>('0.00s / 0.00s');
    const [descriptors, setDescriptors] = useState<string[]>([]);
    const [isMetaLoading, setIsMetaLoading] = useState<boolean>(false);
    const [metaError, setMetaError] = useState<boolean>(false);

    // Visualizer Customization Config State
    const [config, setConfig] = useState<VisualizerConfig>({
        windowSize: 1024,
        sampleSkip: 9,
        thickness: 2,
        secondaryOpacity: 0.5,
        frequencyCount: 512,
        barGap: 1.5,
        barFrequency: 1.0,
        oscBg: '#1f3626',
        specBg: '#0c1533',
        waveformBg: '#5ec7f4',
        waveformSecondaryBg: '#f472b6',
        lineGlow: '#38bdf8',
        barColors: ['#10b981', '#38bdf8'],
    });

    // DOM Canvas Ref
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Web Audio Context & Data Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const analyserNodeRef = useRef<AnalyserNode | null>(null);
    const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

    // Audio Channel Buffers
    const leftChannelRef = useRef<Float32Array | null>(null);
    const rightChannelRef = useRef<Float32Array | null>(null);

    // Animation Loop Refs
    const currentIndexRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const animationIdRef = useRef<number | null>(null);
    const animateRef = useRef<((currentTime: number) => void) | null>(null);

    // Track isPlaying in a Ref to avoid stale closures inside requestAnimationFrame
    const isPlayingRef = useRef<boolean>(false);

    const updatePlayingState = useCallback((playing: boolean) => {
        isPlayingRef.current = playing;
        setIsPlaying(playing);
    }, []);

    // Helper for config updates
    const updateConfig = (key: keyof VisualizerConfig, value: unknown) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const updateProgressUI = useCallback(() => {
        const audioBuffer = audioBufferRef.current;
        if (!audioBuffer) return;

        const currentSec = currentIndexRef.current / audioBuffer.sampleRate;
        const totalSec = audioBuffer.duration;
        setProgressText(`${currentSec.toFixed(2)}s / ${totalSec.toFixed(2)}s`);
    }, []);

    const stopAudioPlayback = useCallback(() => {
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop();
                audioSourceRef.current.disconnect();
            } catch {
                // Audio already stopped
            }
            audioSourceRef.current = null;
        }
    }, []);

    const startAudioPlayback = useCallback(() => {
        const audioBuffer = audioBufferRef.current;
        if (!audioBuffer) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        const audioCtx = audioContextRef.current;

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        stopAudioPlayback();

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = config.frequencyCount;
        analyser.smoothingTimeConstant = 0.8;
        frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        const startOffsetSec = currentIndexRef.current / audioBuffer.sampleRate;
        source.start(0, startOffsetSec);

        audioSourceRef.current = source;
        analyserNodeRef.current = analyser;
    }, [config.frequencyCount, stopAudioPlayback]);

    const renderCurrentFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderCtx: RenderContext = {
            canvas,
            ctx,
            mode,
            config,
            currentIndex: currentIndexRef.current,
            totalSamples: audioBufferRef.current ? audioBufferRef.current.length : 0,
            primaryChannel,
            leftChannel: leftChannelRef.current,
            rightChannel: rightChannelRef.current,
            analyserNode: analyserNodeRef.current,
            frequencyData: frequencyDataRef.current,
            isPlaying,
        };

        if (mode === 'oscilloscope') {
            drawOscilloscopeFrame(renderCtx);
        } else {
            drawSpectrumFrame(renderCtx);
        }
    }, [mode, config, primaryChannel, isPlaying]);

    const animate = useCallback((currentTime: number) => {
        // Read from Ref instead of state to prevent stale closure lock
        if (!isPlayingRef.current) return;

        const audioBuffer = audioBufferRef.current;
        const sampleRate = audioBuffer ? audioBuffer.sampleRate : 44100;

        const deltaTime = (currentTime - lastTimeRef.current) / 1000;
        lastTimeRef.current = currentTime;

        const samplesToAdvance = Math.floor(deltaTime * sampleRate);
        currentIndexRef.current += samplesToAdvance;

        const totalSamples = audioBuffer ? audioBuffer.length : 0;
        const maxIndex = totalSamples - config.windowSize;

        if (currentIndexRef.current >= maxIndex) {
            currentIndexRef.current = Math.max(0, maxIndex);
            stopAudioPlayback();
            renderCurrentFrame();
            updateProgressUI();
            updatePlayingState(false);
            return;
        }

        renderCurrentFrame();
        updateProgressUI();
        // Call via the ref to avoid referencing 'animate' during declaration
        if (animateRef.current) {
            animationIdRef.current = requestAnimationFrame(animateRef.current);
        }
    }, [config.windowSize, stopAudioPlayback, renderCurrentFrame, updateProgressUI, updatePlayingState]);

    const togglePlayPause = () => {
        if (!leftChannelRef.current) return;

        if (isPlayingRef.current) {
            // PAUSE
            stopAudioPlayback();
            updatePlayingState(false);
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        } else {
            // PLAY
            startAudioPlayback();
            updatePlayingState(true);
            lastTimeRef.current = performance.now();
            animationIdRef.current = requestAnimationFrame(animate);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset Playback
        setIsPlaying(false);
        if (audioSourceRef.current) {
            try { audioSourceRef.current.stop(); } catch { /* ignore */ }
        }
        currentIndexRef.current = 0;

        setFileInfo({
            name: file.name,
            sizeMb: (file.size / (1024 * 1024)).toFixed(2),
        });

        setMetaPlaceholder('Decoding audio file into raw PCM array...');
        setMetaError(false);
        setIsMetaLoading(true);

        try {
            const arrayBuffer = await file.arrayBuffer();

            if (!audioContextRef.current) {
                const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                audioContextRef.current = new AudioCtxClass();
            }

            const audioCtx = audioContextRef.current;
            // Handle AudioContext suspended state (browser autoplay policies)
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            audioBufferRef.current = decodedBuffer;

            // Extract Channels
            const leftData = decodedBuffer.getChannelData(0);
            const rightData = decodedBuffer.numberOfChannels > 1 ? decodedBuffer.getChannelData(1) : null;

            leftChannelRef.current = leftData;
            rightChannelRef.current = rightData;

            if (rightData) {
                setIsStereo(true);
            } else {
                setPrimaryChannel('left');
                setIsStereo(false);
            }

            // Load all other metadata asynchronously with progressive state updates
            const result = await loadMetadata(leftData, decodedBuffer, rightData, (partialRows) => {
                setMetadataRows(partialRows);
            });

            setMetadataRows(result.rows);
            setDescriptors(result.audioDescriptors);

            setIsAudioLoaded(true);
            renderCurrentFrame();
        } catch (err) {
            setMetaError(true);
            setMetaPlaceholder(`Error decoding file: ${(err as Error).message}`);
        } finally {
            setIsMetaLoading(false);
        }
    };

    // Re-render when config state mutates
    useEffect(() => {
        renderCurrentFrame();
    }, [config, renderCurrentFrame]);

    // Keep animateRef synced with the current animate function instance
    useEffect(() => {
        animateRef.current = animate;
    }, [animate]);

    // Ensure animation frame cancels when the component unmounts
    useEffect(() => {
        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            stopAudioPlayback();
        };
    }, [stopAudioPlayback]);

    return (
        <div className="container">
            <h1>AudioInfo</h1>

            {/* File Upload Section */}
            <div className="upload-section">
                <label htmlFor="audioInput" className="file-label">Choose Audio File</label>
                <input
                    type="file"
                    id="audioInput"
                    accept=".mp3, .wav, audio/mpeg, audio/wav"
                    onChange={handleFileUpload}
                />
                <span id="fileNameDisplay">
                    {fileInfo ? `${fileInfo.name} (${fileInfo.sizeMb} MB)` : 'No file selected'}
                </span>
            </div>

            {/* Metadata Card */}
            <div className="info-card" id="metaCard">
                <div className="card-header">
                    <h2>Audio Metadata</h2>
                    <button
                        id="toggleMetaBtn"
                        className={`icon-toggle-btn ${isMetaOpen ? 'active' : ''}`}
                        title="Toggle Metadata Details"
                        onClick={() => setIsMetaOpen(!isMetaOpen)}
                    >
                        <span className="chevron-icon">{'▲'}</span>
                    </button>
                </div>

                <div id="metaDrawer" className={`meta-drawer ${isMetaOpen ? 'open' : ''} ${isMetaLoading ? 'is-loading' : ''}`}>
                    <MetadataDisplay
                        rows={metadataRows}
                        descriptors={descriptors}
                        placeholderText={metaPlaceholder}
                        isLoading={isMetaLoading}
                        isError={metaError}
                    />
                </div>
            </div>

            {/* Visualizer Card */}
            <div className="info-card" id="visualizerCard">
                <div className="card-header">
                    <h2 id="visualizerTitle">
                        {mode === 'oscilloscope' ? 'Oscilloscope Visualizer' : 'Spectrum Visualizer'}
                    </h2>

                    <div className="header-actions">
                        <div className="toggle-group">
                            <button
                                id="oscilloscopeModeBtn"
                                className={`toggle-btn ${mode === 'oscilloscope' ? 'active' : ''}`}
                                title="Time Domain Waveform"
                                onClick={() => setMode('oscilloscope')}
                            >
                                Waveform
                            </button>
                            <button
                                id="spectrumModeBtn"
                                className={`toggle-btn ${mode === 'spectrum' ? 'active' : ''}`}
                                title="Frequency Spectrum (FFT)"
                                onClick={() => setMode('spectrum')}
                            >
                                Spectrum
                            </button>
                        </div>

                        <button
                            id="toggleConfigBtn"
                            className={`config-toggle-btn ${isConfigOpen ? 'active' : ''}`}
                            title="Toggle Configuration Panel"
                            onClick={() => setIsConfigOpen(!isConfigOpen)}
                        >
                            ⚙️
                        </button>
                    </div>
                </div>

                {/* Configuration Panel */}
                <div id="configDrawer" className={`config-drawer ${isConfigOpen ? 'open' : ''}`}>
                    <div className="config-grid">

                        {/* COMMON SETTINGS */}
                        <div className="config-item" data-mode="common">
                            <label>Glow Color</label>
                            <div className="color-picker-wrapper">
                                <input
                                    type="color"
                                    id="lineGlowPicker"
                                    value={config.lineGlow}
                                    onChange={(e) => updateConfig('lineGlow', e.target.value)}
                                />
                                <span className="hex-badge">{config.lineGlow}</span>
                            </div>
                        </div>

                        {/* OSCILLOSCOPE SETTINGS */}
                        {mode === 'oscilloscope' ? (
                            <>
                                <div className="config-item" data-mode="oscilloscope">
                                    <label>Window Size: <span className="val-badge">{config.windowSize}</span></label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={WINDOW_SIZE_STEPS.length - 1}
                                        step={1}
                                        value={WINDOW_SIZE_STEPS.indexOf(config.windowSize)}
                                        onChange={(e) =>
                                            updateConfig('windowSize', WINDOW_SIZE_STEPS[Number(e.target.value)])
                                        }
                                    />
                                </div>

                                <div className="config-item" data-mode="oscilloscope">
                                    <label>Sample Skip: <span className="val-badge">{config.sampleSkip}</span></label>
                                    <input
                                        type="range"
                                        min={1}
                                        max={50}
                                        step={1}
                                        value={config.sampleSkip}
                                        onChange={(e) => updateConfig('sampleSkip', Number(e.target.value))}
                                    />
                                </div>

                                <div className="config-item" data-mode="oscilloscope">
                                    <label>Thickness: <span className="val-badge">{config.thickness.toFixed(1)}</span></label>
                                    <input
                                        type="range"
                                        min={0.5}
                                        max={5.0}
                                        step={0.5}
                                        value={config.thickness}
                                        onChange={(e) => updateConfig('thickness', Number(e.target.value))}
                                    />
                                </div>

                                <div className="config-item" data-mode="oscilloscope">
                                    <label>Background</label>
                                    <div className="color-picker-wrapper">
                                        <input
                                            type="color"
                                            value={config.oscBg}
                                            onChange={(e) => updateConfig('oscBg', e.target.value)}
                                        />
                                        <span className="hex-badge">{config.oscBg}</span>
                                    </div>
                                </div>

                                <div className="config-item" data-mode="oscilloscope">
                                    <label>Primary Wave Color</label>
                                    <div className="color-picker-wrapper">
                                        <input
                                            type="color"
                                            value={config.waveformBg}
                                            onChange={(e) => updateConfig('waveformBg', e.target.value)}
                                        />
                                        <span className="hex-badge">{config.waveformBg}</span>
                                    </div>
                                </div>

                                {/* STEREO-ONLY CONTROLS */}
                                {isStereo && (
                                    <>
                                        <div className="config-item stereo-only" data-mode="oscilloscope">
                                            <label>Secondary Wave Color</label>
                                            <div className="color-picker-wrapper">
                                                <input
                                                    type="color"
                                                    value={config.waveformSecondaryBg}
                                                    onChange={(e) => updateConfig('waveformSecondaryBg', e.target.value)}
                                                />
                                                <span className="hex-badge">{config.waveformSecondaryBg}</span>
                                            </div>
                                        </div>

                                        <div className="config-item stereo-only" data-mode="oscilloscope">
                                            <label>Primary Channel</label>
                                            <div className="toggle-group">
                                                <button
                                                    type="button"
                                                    className={`toggle-btn ${primaryChannel === 'left' ? 'active' : ''}`}
                                                    onClick={() => setPrimaryChannel('left')}
                                                >
                                                    Left (L)
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`toggle-btn ${primaryChannel === 'right' ? 'active' : ''}`}
                                                    onClick={() => setPrimaryChannel('right')}
                                                >
                                                    Right (R)
                                                </button>
                                            </div>
                                        </div>

                                        <div className="config-item stereo-only" data-mode="oscilloscope">
                                            <label>Secondary Wave Opacity: <span className="val-badge">{config.secondaryOpacity.toFixed(2)}</span></label>
                                            <input
                                                type="range"
                                                min={0.0}
                                                max={1.0}
                                                step={0.05}
                                                value={config.secondaryOpacity}
                                                onChange={(e) => updateConfig('secondaryOpacity', Number(e.target.value))}
                                            />
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            /* SPECTRUM SETTINGS */
                            <>
                                <div className="config-item" data-mode="spectrum">
                                    <label>Frequency Count (FFT): <span className="val-badge">{config.frequencyCount}</span></label>
                                    <input
                                        type="range"
                                        min={3}
                                        max={10}
                                        step={1}
                                        value={Math.log2(config.frequencyCount)}
                                        onChange={(e) => {
                                            const newCount = Math.pow(2, Number(e.target.value));
                                            updateConfig('frequencyCount', newCount);

                                            if (analyserNodeRef.current) {
                                                analyserNodeRef.current.fftSize = newCount * 2;
                                                frequencyDataRef.current = new Uint8Array(
                                                    analyserNodeRef.current.frequencyBinCount
                                                );
                                            }
                                        }}
                                    />
                                </div>

                                <div className="config-item" data-mode="spectrum">
                                    <label>Bar Gap: <span className="val-badge">{config.barGap.toFixed(1)}</span></label>
                                    <input
                                        type="range"
                                        min={0.0}
                                        max={30.0}
                                        step={0.1}
                                        value={config.barGap}
                                        onChange={(e) => updateConfig('barGap', Number(e.target.value))}
                                    />
                                </div>

                                <div className="config-item" data-mode="spectrum">
                                    <label>Frequency Span: <span className="val-badge">{Math.round(config.barFrequency * 100)}%</span></label>
                                    <input
                                        type="range"
                                        min={0.1}
                                        max={1.0}
                                        step={0.05}
                                        value={config.barFrequency}
                                        onChange={(e) => updateConfig('barFrequency', Number(e.target.value))}
                                    />
                                </div>

                                <div className="config-item" data-mode="spectrum">
                                    <label>Background</label>
                                    <div className="color-picker-wrapper">
                                        <input
                                            type="color"
                                            value={config.specBg}
                                            onChange={(e) => updateConfig('specBg', e.target.value)}
                                        />
                                        <span className="hex-badge">{config.specBg}</span>
                                    </div>
                                </div>

                                {/* GRADIENT PALETTE MANAGER */}
                                <div className="config-item full-width" data-mode="spectrum">
                                    <PaletteManager
                                        barColors={config.barColors}
                                        onChangeColors={(colors) => updateConfig('barColors', colors)}
                                    />
                                </div>
                            </>
                        )}

                    </div>
                </div>

                {/* Main Canvas */}
                <div className="canvas-container">
                    <canvas ref={canvasRef} width={800} height={240} />
                </div>

                {/* Playback Controls Row */}
                <div className="controls-row">
                    <button
                        id="playPauseBtn"
                        className="control-btn"
                        disabled={!isAudioLoaded}
                        onClick={togglePlayPause}
                    >
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>

                    <button
                        id="resetBtn"
                        className="control-btn secondary"
                        disabled={!isAudioLoaded}
                        onClick={() => {
                            currentIndexRef.current = 0;
                            renderCurrentFrame();
                            updateProgressUI();
                        }}
                    >
                        Reset
                    </button>

                    <span id="progressDisplay">{progressText}</span>
                </div>
            </div>
        </div>
    );
};
