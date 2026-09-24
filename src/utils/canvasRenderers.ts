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
    channelData: Float32Array,
    currentIndex: number,
    windowSize: number,
    totalSamples: number,
    sampleSkip: number,
    width: number,
    height: number,
    centerY: number
): void {
    const sliceEnd = Math.min(currentIndex + windowSize, totalSamples);
    const slice = channelData.subarray(currentIndex, sliceEnd);
    const samplesPerPixel = slice.length / width;

    ctx.beginPath();
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
        const y = centerY - sampleVal * (height / 2.2);

        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
}

export function drawOscilloscopeFrame(renderCtx: RenderContext): void {
    const { canvas, ctx, config, currentIndex, totalSamples, primaryChannel, leftChannel, rightChannel } = renderCtx;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.fillStyle = config.oscBg;
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.strokeStyle = '#182d16';
    ctx.lineWidth = 1;
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (!leftChannel) return;

    const isStereo = rightChannel !== null;
    const primaryBuffer = primaryChannel === 'left' ? leftChannel : (rightChannel ?? leftChannel);
    const secondaryBuffer = isStereo ? (primaryChannel === 'left' ? rightChannel : leftChannel) : null;

    // Draw Secondary Translucent Channel
    if (secondaryBuffer && config.secondaryOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = config.secondaryOpacity;
        ctx.lineWidth = config.thickness;
        ctx.strokeStyle = config.waveformSecondaryBg;
        ctx.shadowBlur = 3;
        ctx.shadowColor = config.lineGlow;
        traceWaveformPath(ctx, secondaryBuffer, currentIndex, config.windowSize, totalSamples, config.sampleSkip, width, height, centerY);
        ctx.stroke();
        ctx.restore();
    }

    // Draw Primary Channel
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = config.thickness;
    ctx.strokeStyle = config.waveformBg;
    ctx.shadowBlur = 5;
    ctx.shadowColor = config.lineGlow;
    traceWaveformPath(ctx, primaryBuffer, currentIndex, config.windowSize, totalSamples, config.sampleSkip, width, height, centerY);
    ctx.stroke();
    ctx.restore();
}

export function drawSpectrumFrame(renderCtx: RenderContext): void {
    const { canvas, ctx, config, analyserNode, frequencyData, isPlaying } = renderCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = config.specBg;
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
    const activeBins = Math.floor(totalBins * config.barFrequency);
    const barWidth = width / activeBins - config.barGap;
    const binStep = totalBins / activeBins;

    // for (let i = 0; i < activeBins; i++) {
    //     const dataIndex = Math.floor(i * binStep);
    //     const value = frequencyData[dataIndex] / 255.0;
    //     const barHeight = Math.max(2, value * height);
    //     const x = i * (barWidth + config.barGap);
    //     const y = height - barHeight;

    //     const gradient = ctx.createLinearGradient(0, height, 0, y);
    //     if (config.barColors.length === 1) {
    //         gradient.addColorStop(0, config.barColors[0]);
    //         gradient.addColorStop(1, config.barColors[0]);
    //     } else {
    //         config.barColors.forEach((color, idx) => {
    //             const stop = idx / (config.barColors.length - 1);
    //             gradient.addColorStop(stop, color);
    //         });
    //     }

    //     ctx.fillStyle = gradient;
    //     ctx.shadowBlur = 3;
    //     ctx.shadowColor = config.lineGlow;
    //     ctx.fillRect(x, y, barWidth, barHeight);
    // }


    // CREATE A SINGLE GRADIENT FOR ALL BARS (Huge Mobile Performance Gain)
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    if (config.barColors.length === 1) {
        gradient.addColorStop(0, config.barColors[0]);
        gradient.addColorStop(1, config.barColors[0]);
    } else {
        config.barColors.forEach((color, idx) => {
            const stop = idx / (config.barColors.length - 1);
            gradient.addColorStop(stop, color);
        });
    }

    // SET CANVAS STYLES ONCE
    ctx.fillStyle = gradient;

    if (config.lineGlow && config.lineGlow !== 'transparent') {
        ctx.shadowBlur = 2;
        ctx.shadowColor = config.lineGlow;
    } else {
        ctx.shadowBlur = 0;
    }

    // BATCH GPU DRAW CALL FOR ALL BARS
    ctx.beginPath();
    
    for (let i = 0; i < activeBins; i++) {
        const dataIndex = Math.floor(i * binStep);
        const value = frequencyData[dataIndex] / 255.0;
        const barHeight = Math.max(2, value * height);
        const x = i * (barWidth + config.barGap);
        const y = height - barHeight;
        ctx.rect(x, y, barWidth, barHeight);
    }

    // Single pass draw call for all bars
    ctx.fill();

    ctx.shadowBlur = 0;
}
