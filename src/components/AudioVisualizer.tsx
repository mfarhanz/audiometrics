import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { VisualizerConfig, VisualizerMode, PrimaryChannel, RenderContext } from '../types/visualizer';
import type { MetadataRow } from '../types/metadata';
import type { AudioFileInfo } from '../types/audio';
import { MetadataDisplay } from './MetadataDisplay';
import { PaletteManager } from './PaletteManager';
import { drawOscilloscopeFrame, drawSpectrumFrame } from '../utils/canvasRenderers';
import { loadMetadata } from '../services/metadataLoader';
import { BLEND_MODES, SPECTRUM_BAR_STYLES, WINDOW_SIZES } from '../data/constants';
import { AudioScrubber } from './AudioScrubber';
import { DEFAULT_CONFIG } from '../data/constants';
import { ToggleGroup } from './ToggleGroup';

export const AudioVisualizer: React.FC = () => {
    // Mode & Drawer State
    const [mode, setMode] = useState<VisualizerMode>('oscilloscope');
    const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
    const [isMetaOpen, setIsMetaOpen] = useState<boolean>(false);

    // Audio Processing State
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isAudioLoaded, setIsAudioLoaded] = useState<boolean>(false);
    const [isStereo, setIsStereo] = useState<boolean>(false);
    const [primaryChannel, setPrimaryChannel] = useState<PrimaryChannel>('left');
    const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null); // needed for Scrubber
    const [currentIndex, setCurrentIndex] = useState<number>(0);

    // Metadata Display State
    const [metaPlaceholder, setMetaPlaceholder] = useState<string>('');
    const [metadataRows, setMetadataRows] = useState<MetadataRow[]>([]);
    const [progressText, setProgressText] = useState<string>('0.00s / 0.00s');
    const [descriptors, setDescriptors] = useState<string[]>([]);
    const [isMetaLoading, setIsMetaLoading] = useState<boolean>(false);
    const [metaError, setMetaError] = useState<boolean>(false);

    // Visualizer Customization Config State
    const [config, setConfig] = useState<VisualizerConfig>({
        windowSize: DEFAULT_CONFIG.WINDOW_SIZE,
        sampleSkip: DEFAULT_CONFIG.SAMPLE_SKIP,
        thickness: DEFAULT_CONFIG.WAVE_THICKNESS,
        smoothing: DEFAULT_CONFIG.WAVE_SMOOTHING,
        frequencyCount: DEFAULT_CONFIG.FREQUENCY_COUNT,
        barGap: DEFAULT_CONFIG.FREQUENCY_BAR_GAP,
        barDensity: DEFAULT_CONFIG.FREQUENCY_BAR_DENSITY,
        oscBg: DEFAULT_CONFIG.OSCILLOSCOPE_BACKGROUND,
        specBg: DEFAULT_CONFIG.SPECTRUM_VISUALIZER_BACKGROUND,
        secondaryOpacity: DEFAULT_CONFIG.SECONDARY_WAVE_OPACITY,
        waveBg: DEFAULT_CONFIG.WAVE_BACKGROUND,
        waveSecondaryBg: DEFAULT_CONFIG.SECONDARY_WAVE_BACKGROUND,
        lineGlow: DEFAULT_CONFIG.GLOW_COLOR,
        barColors: [...DEFAULT_CONFIG.FREQUENCY_BAR_COLORS],
        barStyle: DEFAULT_CONFIG.FREQUENCY_BAR_STYLE,
        showGrid: DEFAULT_CONFIG.SHOW_OSCILLOSCOPE_GRID,
        gridColor: DEFAULT_CONFIG.OSCILLOSCOPE_GRID_COLOR,
        gridDivisionsX: DEFAULT_CONFIG.OSCILLOSCOPE_GRID_X_DIVISIONS,
        gridDivisionsY: DEFAULT_CONFIG.OSCILLOSCOPE_GRID_Y_DIVISIONS,
        gridSubdivisions: DEFAULT_CONFIG.OSCILLOSCOPE_GRID_SUBDIVISIONS,
        primaryBlendMode: DEFAULT_CONFIG.WAVE_BLEND_MODE
    });

    // Main Canvas Ref
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

    const startAudioPlayback = useCallback(async () => {
        const audioBuffer = audioBufferRef.current;
        if (!audioBuffer) return;

        if (!audioContextRef.current) {
            const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioContextRef.current = new AudioCtxClass();
        }
        const audioCtx = audioContextRef.current;

        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
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

        // Only pull fresh FFT frequency data from AnalyserNode while playing.
        // When paused, frequencyDataRef.current retains the final active snapshot.
        if (isPlayingRef.current && analyserNodeRef.current && frequencyDataRef.current) {
            analyserNodeRef.current.getByteFrequencyData(frequencyDataRef.current);
        }

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
            isPlaying: isPlayingRef.current,
        };

        if (mode === 'oscilloscope') {
            drawOscilloscopeFrame(renderCtx);
        } else {
            drawSpectrumFrame(renderCtx);
        }
    }, [mode, config, primaryChannel]);

    const resetPlayback = useCallback(() => {
        // Stop active WebAudio playback source
        stopAudioPlayback();

        // Cancel scheduled requestAnimationFrame loop
        if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
        }

        // Clear stored frequency data snapshot on reset
        if (frequencyDataRef.current) {
            frequencyDataRef.current.fill(0);
        }

        // Reset index and timing references
        currentIndexRef.current = 0;
        setCurrentIndex(0); // Sync state on reset
        lastTimeRef.current = performance.now();

        // Update play state (triggers UI re-render for Play button label)
        updatePlayingState(false);

        // Draw initial frame and refresh progress text
        renderCurrentFrame();
        updateProgressUI();
    }, [stopAudioPlayback, updatePlayingState, renderCurrentFrame, updateProgressUI]);

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
            const finalIndex = Math.max(0, maxIndex);
            currentIndexRef.current = finalIndex;
            setCurrentIndex(finalIndex); // Sync final frame
            stopAudioPlayback();
            renderCurrentFrame();
            updateProgressUI();
            updatePlayingState(false);
            return;
        }

        // Sync current sample index to state for scrubber playhead rendering
        setCurrentIndex(currentIndexRef.current);

        renderCurrentFrame();
        updateProgressUI();
        // Call via the ref to avoid referencing 'animate' during declaration
        if (animateRef.current) {
            animationIdRef.current = requestAnimationFrame(animateRef.current);
        }
    }, [config.windowSize, stopAudioPlayback, renderCurrentFrame, updateProgressUI, updatePlayingState]);

    const togglePlayPause = async () => {
        if (!leftChannelRef.current) return;

        if (isPlayingRef.current) {
            // PAUSE
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }

            updatePlayingState(false);
            stopAudioPlayback();
        } else {
            // PLAY
            await startAudioPlayback();
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
        setCurrentIndex(0);            // Sync to state

        setFileInfo({
            name: file.name,
            sizeMb: (file.size / (1024 * 1024)).toFixed(2),
        });

        setMetaPlaceholder('Decoding audio file into raw PCM array...');
        setMetaError(false);
        setDescriptors([]);
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
            setAudioBuffer(decodedBuffer); // Sync to state for Scrubber

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
            const result = await loadMetadata(
                leftData,
                decodedBuffer,
                rightData,
                (partialRows) => setMetadataRows(partialRows),
                setMetaPlaceholder
            );

            setMetadataRows(result.rows);
            setDescriptors(result.audioDescriptors);

            setIsAudioLoaded(true);
            renderCurrentFrame();
        } catch (err) {
            setMetaError(true);
            setMetaPlaceholder(`Error decoding file: ${(err as Error).message}`);
        } finally {
            setIsMetaLoading(false);
            // event.target.value = ''; // Allows re-selecting the same file if needed
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

    const seekTo = useCallback(async (targetIndex: number) => {
        const currentBuffer = audioBufferRef.current;
        if (!currentBuffer) return;

        // Clamp index bounds
        const maxIndex = currentBuffer.length - config.windowSize;
        const clampedIndex = Math.max(0, Math.min(targetIndex, maxIndex));

        currentIndexRef.current = clampedIndex;
        setCurrentIndex(clampedIndex);

        // If audio is currently playing, restart playback at the new seek location
        if (isPlayingRef.current) {
            await startAudioPlayback();
        }

        // Refresh visualizer frame and text UI immediately
        renderCurrentFrame();
        updateProgressUI();
    }, [config.windowSize, startAudioPlayback, renderCurrentFrame, updateProgressUI]);

    return (
        <div className="app-container">
            {/* Header & Upload Section */}
            <div className={`constrained-container ${isMetaOpen ? 'expanded' : 'constrained'} dynamic-width`}>
                <h1>AudioInfo</h1>
                <div className="upload-section">
                    <label htmlFor="audioInput" className="file-label">
                        <span className="label-text">
                            {isMetaOpen ? '♫' : 'Choose File'}
                        </span>
                    </label>
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
            </div>


            {/* Metadata Card */}
            <div className={`meta-card-wrapper ${isMetaOpen ? 'expanded' : 'constrained'}`}>
                <div className="info-card" id="metaCard">
                    <div className="card-header ">
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
            </div>

            {/* Visualizer Card */}
            <div className='constrained-container dynamic-width'>
                <div className="info-card" id="visualizerCard">
                    <div className="card-header">
                        <h2 id="visualizerTitle">
                            {mode === 'oscilloscope' ? 'Oscilloscope Visualizer' : 'Spectrum Visualizer'}
                        </h2>

                        <div className="header-actions">
                            {/* <div className="toggle-group">
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
                            </div> */}
                            <ToggleGroup
                                value={mode}
                                onChange={setMode}
                                options={[
                                    { label: 'Waveform', value: 'oscilloscope', title: 'Time Domain Waveform' },
                                    { label: 'Spectrum', value: 'spectrum', title: 'Frequency Spectrum (FFT)' },
                                ]}
                            />

                            <button
                                id="toggleConfigBtn"
                                className={`config-toggle-btn ${isConfigOpen ? 'active' : ''}`}
                                title="Toggle config panel"
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
                                            max={WINDOW_SIZES.length - 1}
                                            step={1}
                                            value={WINDOW_SIZES.indexOf(config.windowSize)}
                                            onChange={(e) =>
                                                updateConfig('windowSize', WINDOW_SIZES[Number(e.target.value)])
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
                                        <label>Smoothing</label>
                                        {/* <div className="toggle-group">
                                            <button
                                                type="button"
                                                className={`toggle-btn ${config.smoothing ? 'active' : ''}`}
                                                onClick={() => updateConfig('smoothing', true)}
                                            >
                                                On
                                            </button>
                                            <button
                                                type="button"
                                                className={`toggle-btn ${!config.smoothing ? 'active' : ''}`}
                                                onClick={() => updateConfig('smoothing', false)}
                                            >
                                                Off
                                            </button>
                                        </div> */}
                                        <ToggleGroup
                                            value={config.smoothing!}
                                            onChange={(val) => updateConfig('smoothing', val)}
                                            options={[
                                                { label: 'On', value: true },
                                                { label: 'Off', value: false },
                                            ]}
                                        />
                                    </div>

                                    <div className="config-item" data-mode="oscilloscope">
                                        <label>Blend Mode</label>
                                        {/* <div className="toggle-group">
                                            {BLEND_MODES.map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    className={`toggle-btn ${(config.primaryBlendMode ?? 'normal') === mode ? 'active' : ''
                                                        }`}
                                                    onClick={() =>
                                                        updateConfig(
                                                            'primaryBlendMode',
                                                            mode === 'none' ? undefined : mode
                                                        )
                                                    }
                                                >
                                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                </button>
                                            ))}
                                        </div> */}
                                        <ToggleGroup
                                            value={config.primaryBlendMode ?? 'normal'}
                                            onChange={(val) => updateConfig('primaryBlendMode', val === 'normal' ? undefined : val)}
                                            options={BLEND_MODES.map((mode) => ({
                                                label: mode.charAt(0).toUpperCase() + mode.slice(1),
                                                value: mode,
                                            }))}
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
                                                value={config.waveBg}
                                                onChange={(e) => updateConfig('waveBg', e.target.value)}
                                            />
                                            <span className="hex-badge">{config.waveBg}</span>
                                        </div>
                                    </div>

                                    <div className="config-item" data-mode="oscilloscope">
                                        <label>Show Grid</label>
                                        {/* <div className="toggle-group">
                                            <button
                                                type="button"
                                                className={`toggle-btn ${config.showGrid ? 'active' : ''}`}
                                                onClick={() => updateConfig('showGrid', true)}
                                            >
                                                Show
                                            </button>
                                            <button
                                                type="button"
                                                className={`toggle-btn ${!config.showGrid ? 'active' : ''}`}
                                                onClick={() => updateConfig('showGrid', false)}
                                            >
                                                Hide
                                            </button>
                                        </div> */}
                                        <ToggleGroup
                                            value={config.showGrid!}
                                            onChange={(val) => updateConfig('showGrid', val)}
                                            options={[
                                                { label: 'Show', value: true },
                                                { label: 'Hide', value: false },
                                            ]}
                                        />
                                    </div>

                                    {config.showGrid && (
                                        <>
                                            <div className="config-item" data-mode="oscilloscope">
                                                <label>Grid Color</label>
                                                <div className="color-picker-wrapper">
                                                    <input
                                                        type="color"
                                                        value={config.gridColor}
                                                        onChange={(e) => updateConfig('gridColor', e.target.value)}
                                                    />
                                                    <span className="hex-badge">{config.gridColor}</span>
                                                </div>
                                            </div>

                                            <div className="config-item" data-mode="oscilloscope">
                                                <label>Grid X Divisions: <span className="val-badge">{config.gridDivisionsX}</span></label>
                                                <input
                                                    type="range"
                                                    min={4}
                                                    max={32}
                                                    step={2}
                                                    value={config.gridDivisionsX}
                                                    onChange={(e) => updateConfig('gridDivisionsX', Number(e.target.value))}
                                                />
                                            </div>

                                            <div className="config-item" data-mode="oscilloscope">
                                                <label>Grid Y Divisions: <span className="val-badge">{config.gridDivisionsY}</span></label>
                                                <input
                                                    type="range"
                                                    min={2}
                                                    max={16}
                                                    step={2}
                                                    value={config.gridDivisionsY}
                                                    onChange={(e) => updateConfig('gridDivisionsY', Number(e.target.value))}
                                                />
                                            </div>

                                            <div className="config-item" data-mode="oscilloscope">
                                                <label>Grid Subdivisions: <span className="val-badge">{config.gridSubdivisions}</span></label>
                                                <input
                                                    type="range"
                                                    min={1}
                                                    max={10}
                                                    step={1}
                                                    value={config.gridSubdivisions}
                                                    onChange={(e) => updateConfig('gridSubdivisions', Number(e.target.value))}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* STEREO-ONLY CONTROLS */}
                                    {isStereo && (
                                        <>
                                            <div className="config-item stereo-only" data-mode="oscilloscope">
                                                <label>Secondary Wave Color</label>
                                                <div className="color-picker-wrapper">
                                                    <input
                                                        type="color"
                                                        value={config.waveSecondaryBg}
                                                        onChange={(e) => updateConfig('waveSecondaryBg', e.target.value)}
                                                    />
                                                    <span className="hex-badge">{config.waveSecondaryBg}</span>
                                                </div>
                                            </div>

                                            <div className="config-item stereo-only" data-mode="oscilloscope">
                                                <label>Primary Channel</label>
                                                {/* <div className="toggle-group">
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
                                                </div> */}
                                                <ToggleGroup
                                                    value={primaryChannel}
                                                    onChange={setPrimaryChannel}
                                                    options={[
                                                        { label: 'Left (L)', value: 'left' },
                                                        { label: 'Right (R)', value: 'right' },
                                                    ]}
                                                />
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
                                        <label>Frequency Count: <span className="val-badge">{config.frequencyCount}</span></label>
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
                                        <label>Frequency Span: <span className="val-badge">{Math.round(config.barDensity * 100)}%</span></label>
                                        <input
                                            type="range"
                                            min={0.1}
                                            max={1.0}
                                            step={0.05}
                                            value={config.barDensity}
                                            onChange={(e) => updateConfig('barDensity', Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="config-item" data-mode="spectrum">
                                        <label>Bar Style</label>
                                        {/* <div className="toggle-group">
                                            {SPECTRUM_BAR_STYLES.map((style) => (
                                                <button
                                                    key={style}
                                                    type="button"
                                                    className={`toggle-btn ${config.barStyle === style ? 'active' : ''}`}
                                                    onClick={() => updateConfig('barStyle', style)}
                                                >
                                                    {style.charAt(0).toUpperCase() + style.slice(1)}
                                                </button>
                                            ))}
                                        </div> */}
                                        <ToggleGroup
                                            value={config.barStyle!}
                                            onChange={(val) => updateConfig('barStyle', val)}
                                            options={SPECTRUM_BAR_STYLES.map((style) => ({
                                                label: style.charAt(0).toUpperCase() + style.slice(1),
                                                value: style,
                                            }))}
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
                    <div className="visualizer-container">
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
                            onClick={resetPlayback}
                        >
                            Reset
                        </button>

                        <span id="progressDisplay">{progressText}</span>

                        <AudioScrubber
                            audioBuffer={audioBuffer}
                            currentIndex={currentIndex}
                            isLoaded={isAudioLoaded}
                            windowSize={config.windowSize}
                            onSeek={seekTo}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
