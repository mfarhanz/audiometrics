import type { RenderContext } from "../types/visualizer";

export function drawEmptyCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, bg: string): void {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

function traceWaveformPath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    channelData: Float32Array,
    currentIndex: number,
    totalSamples: number,
    windowSize: number,
    sampleSkip: number,
    smoothing: boolean = false
): void {
    const sliceEnd = Math.min(currentIndex + windowSize, totalSamples);
    const slice = channelData.subarray(currentIndex, sliceEnd);
    const samplesPerPixel = slice.length / width;

    // Collect raw sampled points
    const rawPoints: { x: number; y: number }[] = [];

    for (let x = 0; x < width; x += sampleSkip) {
        const startSample = Math.floor(x * samplesPerPixel);
        const endSample = Math.floor((x + 1) * samplesPerPixel);

        let sum = 0;
        let count = 0;
        for (let j = startSample; j < endSample && j < slice.length; j++) {
            sum += slice[j];
            count++;
        }

        const sampleVal = count > 0 ? sum / count : 0;
        const y = (height / 2) - sampleVal * (height / 2.2);
        rawPoints.push({ x, y });
    }

    if (rawPoints.length === 0) return;

    // Apply 3-pass Moving Average filter to smooth raw Y values if smoothing is enabled
    let points = rawPoints;
    if (smoothing && rawPoints.length > 2) {
        points = rawPoints.map((pt) => ({ ...pt })); // Clone array

        // multi-pass box blur
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 1; i < points.length - 1; i++) {
                points[i].y =
                    points[i - 1].y * 0.25 +
                    points[i].y * 0.5 +
                    points[i + 1].y * 0.25;
            }
        }
    }

    // Draw Canvas Path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (!smoothing || points.length < 3) {
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
    } else {
        // Smooth Bezier Curve drawing using midpoints
        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const midX = (current.x + next.x) / 2;
            const midY = (current.y + next.y) / 2;
            ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }

        const lastPoint = points[points.length - 1];
        ctx.lineTo(lastPoint.x, lastPoint.y);
    }
}

export function drawOscilloscopeFrame(renderCtx: RenderContext): void {
    const { canvas, ctx, config, currentIndex, totalSamples, primaryChannel, leftChannel, rightChannel } = renderCtx;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.fillStyle = config.oscBg;
    ctx.fillRect(0, 0, width, height);

    // Draw Oscilloscope Grid
    if (config.showGrid) {
        drawOscilloscopeGrid(ctx, width, height, config.gridColor, config.gridDivisionsX, config.gridDivisionsY, config.gridSubdivisions);
    } else {
        // simple baseline if grid is toggled off
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(24, 45, 22, 0.6)';
        ctx.lineWidth = 1;
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    }

    if (!leftChannel) return;

    const isStereo = rightChannel !== null;
    const primaryBuffer = primaryChannel === 'left' ? leftChannel : (rightChannel ?? leftChannel);
    const secondaryBuffer = isStereo ? (primaryChannel === 'left' ? rightChannel : leftChannel) : null;

    // Draw Secondary Channel
    if (secondaryBuffer && config.secondaryOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = config.secondaryOpacity;

        traceWaveformPath(ctx, width, height, secondaryBuffer, currentIndex, totalSamples, config.windowSize, config.sampleSkip, config.smoothing);

        ctx.lineWidth = config.thickness;
        ctx.strokeStyle = config.waveSecondaryBg;
        ctx.shadowBlur = 20;
        ctx.shadowColor = config.lineGlow;
        ctx.stroke();

        ctx.shadowBlur = 0; // Turn off shadow for sharp core
        ctx.stroke();

        ctx.restore();
    }

    // Draw Primary Channel
    ctx.save();
    ctx.globalAlpha = 1.0;
    if (config.primaryBlendMode != undefined) ctx.globalCompositeOperation = config.primaryBlendMode;

    traceWaveformPath(ctx, width, height, primaryBuffer, currentIndex, totalSamples, config.windowSize, config.sampleSkip, config.smoothing);

    // Wide Soft Ambient Glow (Behind)
    ctx.lineWidth = config.thickness;
    ctx.strokeStyle = config.waveBg;
    ctx.shadowBlur = 20;
    ctx.shadowColor = config.lineGlow;
    ctx.stroke();

    //Tight Intense Glow
    ctx.shadowBlur = 8;
    ctx.lineWidth = config.thickness;
    ctx.strokeStyle = config.waveBg;
    ctx.stroke();

    ctx.restore();
}

/**
 * Renders a oscilloscope reticle grid with crisp 1px lines.
 */
function drawOscilloscopeGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    color: string = '#4ade80',
    divisionsX: number = 10,
    divisionsY: number = 8,
    subdivisions: number = 5,
): void {
    const stepX = width / divisionsX;
    const stepY = height / divisionsY;
    const minorStepX = stepX / subdivisions;
    const minorStepY = stepY / subdivisions;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;

    // --- DRAW MINOR GRIDLINES (Fainter) ---
    // ctx.strokeStyle = 'rgba(74, 222, 128, 0.06)'; // Subtle, faint phosphor green
    ctx.globalAlpha = 0.06;
    ctx.beginPath();

    // Minor Vertical Lines
    for (let x = 0; x <= width; x += minorStepX) {
        const roundedX = Math.floor(x) + 0.5; // Offset by 0.5 for rendering clearly
        ctx.moveTo(roundedX, 0);
        ctx.lineTo(roundedX, height);
    }

    // Minor Horizontal Lines
    for (let y = 0; y <= height; y += minorStepY) {
        const roundedY = Math.floor(y) + 0.5;
        ctx.moveTo(0, roundedY);
        ctx.lineTo(width, roundedY);
    }
    ctx.stroke();

    // --- DRAW MAJOR GRIDLINES (More Prominent) ---
    ctx.globalAlpha = 0.22;
    ctx.beginPath();

    // Major Vertical Lines
    for (let i = 0; i <= divisionsX; i++) {
        const x = Math.floor(i * stepX) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    // Major Horizontal Lines
    for (let j = 0; j <= divisionsY; j++) {
        const y = Math.floor(j * stepY) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();

    // --- CENTER AXES ---
    ctx.globalAlpha = 0.45;
    ctx.beginPath();

    // X-Axis
    const axisY = Math.floor(height / 2) + 0.5;
    ctx.moveTo(0, axisY);
    ctx.lineTo(width, axisY);

    // Y-Axis
    const axisX = Math.floor(width / 2) + 0.5;
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, height);

    ctx.stroke();
    ctx.restore();
}

export function drawSpectrumFrame(renderCtx: RenderContext): void {
    const { canvas, ctx, config, analyserNode, frequencyData, isPlaying } = renderCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = config.specBg;  // clear background before drawing
    ctx.fillRect(0, 0, width, height);

    if (!analyserNode || !frequencyData || !isPlaying) {
        ctx.beginPath();
        ctx.strokeStyle = '#182d16';
        ctx.lineWidth = 1;
        ctx.moveTo(0, height - 2);
        ctx.lineTo(width, height - 2);
        ctx.stroke();
        return;
    }

    analyserNode.getByteFrequencyData(frequencyData);

    const totalBins = analyserNode.frequencyBinCount;
    const activeBins = Math.floor(totalBins * config.barDensity);
    const barWidth = width / activeBins - config.barGap;
    const binStep = totalBins / activeBins;
    
    if (config.lineGlow && config.lineGlow !== 'transparent') {
        ctx.shadowBlur = 4;
        ctx.shadowColor = config.lineGlow;
    } else {
        ctx.shadowBlur = 0;
    }

    // Cache color palette stops to avoid string allocations during addColorStop
    const colorStops = config.barColors.length === 1
        ? [{ stop: 0, color: config.barColors[0] }, { stop: 1, color: config.barColors[0] }]
        : config.barColors.map((color, idx) => ({
            stop: idx / (config.barColors.length - 1),
            color,
        }));

    // Draw bars
    for (let i = 0; i < activeBins; i++) {
        const dataIndex = Math.floor(i * binStep);
        const value = frequencyData[dataIndex] / 255.0;
        const barHeight = Math.max(2, value * height);
        const x = i * (barWidth + config.barGap);
        const y = height - barHeight;

        // Create gradient strictly from bottom to top of THIS bar
        const gradient = ctx.createLinearGradient(0, height, 0, y);
        for (let j = 0; j < colorStops.length; j++) {
            gradient.addColorStop(colorStops[j].stop, colorStops[j].color);
        }

        switch (config.barStyle) {
            case 'segmented': {
                const segmentHeight = Math.max(2, Math.floor(barWidth * 0.8));
                const segmentGap = 2;
                const totalSegments = Math.floor(barHeight / (segmentHeight + segmentGap));

                ctx.fillStyle = gradient;
                for (let seg = 0; seg < totalSegments; seg++) {
                    const segY = height - (seg + 1) * (segmentHeight + segmentGap);
                    ctx.fillRect(x, segY, barWidth, segmentHeight);
                }
                break;
            }

            case 'dots': {
                const radius = barWidth / 2;
                const diameter = radius * 2;
                const dotGap = 2;
                const totalDots = Math.floor(barHeight / (diameter + dotGap));

                ctx.fillStyle = gradient;
                for (let d = 0; d < totalDots; d++) {
                    const centerY = height - d * (diameter + dotGap) - radius;
                    ctx.beginPath();
                    ctx.arc(x + radius, centerY, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }

            case 'rounded': {
                const cornerRadius = Math.min(barWidth / 2, 6);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, barHeight, [cornerRadius, cornerRadius, 0, 0]);
                ctx.fill();
                break;
            }

            case 'outline': {
                ctx.strokeStyle = gradient;
                ctx.lineWidth = Math.max(1, config.thickness || 1.5);
                ctx.strokeRect(x + 0.5, y + 0.5, barWidth - 1, barHeight - 1);
                break;
            }

            case 'solid':   // default
            default: {
                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, barWidth, barHeight);
                break;
            }
        }
    }

    ctx.shadowBlur = 0;
}
