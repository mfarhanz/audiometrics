import React, { useRef, useEffect, useCallback, useMemo } from 'react';

interface AudioScrubberProps {
    audioBuffer: AudioBuffer | null;
    currentIndex: number;
    windowSize?: number;
    isLoaded: boolean;
    onSeek: (targetIndex: number) => void;
}

export const AudioScrubber: React.FC<AudioScrubberProps> = ({
    audioBuffer,
    currentIndex,
    windowSize,
    isLoaded,
    onSeek,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Track active dragging state in Refs to eliminate React component re-renders
    const isDraggingRef = useRef<boolean>(false);
    const dragIndexRef = useRef<number | null>(null);

    // Keep onSeek in a ref so event handlers remain perfectly stable
    const onSeekRef = useRef(onSeek);
    useEffect(() => {
        onSeekRef.current = onSeek;
    }, [onSeek]);

    // Calculate waveform peaks
    const peaks = useMemo(() => {
        if (!audioBuffer) return null;

        const channelData = audioBuffer.getChannelData(0);
        const BAR_COUNT = 100;
        const samplesPerBar = Math.floor(channelData.length / BAR_COUNT);
        const calculatedPeaks = new Float32Array(BAR_COUNT);
        const step = windowSize && windowSize > 0 ? windowSize : 100;

        for (let i = 0; i < BAR_COUNT; i++) {
            const start = i * samplesPerBar;
            let maxVal = 0;
            for (let j = 0; j < samplesPerBar; j += step) {
                const absVal = Math.abs(channelData[start + j] || 0);
                if (absVal > maxVal) maxVal = absVal;
            }
            // fallback to a quiet base height if audio segment is near-silent or zero
            calculatedPeaks[i] = Math.max(0.03, maxVal);
        }

        return calculatedPeaks;
    }, [audioBuffer, windowSize]);

    //Helper to compute sample index from client position
    const getSampleIndexFromX = useCallback(
        (clientX: number): number | null => {
            const container = containerRef.current;
            if (!container || !audioBuffer || !isLoaded) return null;

            const rect = container.getBoundingClientRect();
            const clickX = clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            return Math.floor(ratio * audioBuffer.length);
        },
        [audioBuffer, isLoaded]
    );

    const drawScrubber = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerY = height / 2;

        ctx.clearRect(0, 0, width, height);

        if (!isLoaded || !audioBuffer) return;

        const totalSamples = audioBuffer.length;

        // Use active drag ref position if dragging; otherwise fallback to playback index prop
        const displayIndex =
            isDraggingRef.current && dragIndexRef.current !== null
                ? dragIndexRef.current
                : currentIndex;

        const progressRatio = totalSamples > 0 ? displayIndex / totalSamples : 0;
        const playheadX = Math.max(0, Math.min(width, progressRatio * width));

        // Draw waveform vertical bars
        if (peaks && peaks.length > 0) {
            const barWidth = 2;
            const barGap = (width - peaks.length * barWidth) / (peaks.length - 1);

            ctx.lineCap = 'round';
            ctx.lineWidth = barWidth;

            for (let i = 0; i < peaks.length; i++) {
                const barX = i * (barWidth + barGap);
                const barHeight = Math.max(0, peaks[i] * (height - 8));

                const topY = Math.floor(centerY - barHeight / 2);
                const bottomY = Math.floor(centerY + barHeight / 2);

                ctx.strokeStyle =
                    barX + barWidth <= playheadX
                        ? 'rgba(56, 189, 248, 0.8)'
                        : 'rgba(255, 255, 255, 0.1)';

                ctx.beginPath();
                ctx.moveTo(barX, topY);
                ctx.lineTo(barX, bottomY);
                ctx.stroke();
            }
        }
    }, [audioBuffer, currentIndex, isLoaded, peaks]);

    // Handle container resize
    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const resizeObserver = new ResizeObserver(() => {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            drawScrubber();
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [drawScrubber]);

    // Redraw on updates
    useEffect(() => {
        drawScrubber();
    }, [drawScrubber]);

    // Drag Handlers
    const handleDragMove = useCallback(
        (clientX: number) => {
            if (!isDraggingRef.current) return;
            const targetSample = getSampleIndexFromX(clientX);
            if (targetSample !== null) {
                dragIndexRef.current = targetSample;
                // Immediately repaint canvas
                drawScrubber();
            }
        },
        [getSampleIndexFromX, drawScrubber]
    );

    const handleDragEnd = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        const finalTarget = dragIndexRef.current;
        dragIndexRef.current = null;

        if (finalTarget !== null) {
            onSeekRef.current(finalTarget);
        }
        drawScrubber();
    }, [drawScrubber]);

    // Attach listeners dynamically ONLY during active drag sessions
    const handleDragStart = (clientX: number) => {
        isDraggingRef.current = true;
        const targetSample = getSampleIndexFromX(clientX);
        if (targetSample !== null) {
            dragIndexRef.current = targetSample;
            drawScrubber();
        }

        const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches[0]) handleDragMove(e.touches[0].clientX);
        };

        const onDragFinish = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onDragFinish);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onDragFinish);
            handleDragEnd();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onDragFinish);
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onDragFinish);
    };

    return (
        <div
            ref={containerRef}
            className={`scrubber-container ${!isLoaded ? 'disabled' : ''}`}
            onMouseDown={(e) => handleDragStart(e.clientX)}
            onTouchStart={(e) => e.touches[0] && handleDragStart(e.touches[0].clientX)}
        >
            <canvas ref={canvasRef} />
        </div>
    );
};
