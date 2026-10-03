import React, { useEffect, useState } from 'react';
import type { GaugeZone } from '../types/visualizer';

interface MetricGaugeProps {
    value: number | string;
    numericVal?: number;
    color?: string;
    min?: number;
    max?: number;
    ticks?: (number | string)[];
    zones?: GaugeZone[];
}

export const MetricGauge: React.FC<MetricGaugeProps> = ({
    value,
    numericVal,
    color = '#2ecc71',
    min = 0,
    max = 100,
    ticks = [],
    zones = [],
}) => {
    // Initial state starts needle at far left (-90deg)
    const [needleAngle, setNeedleAngle] = useState(-90);

    // Clamp value to range
    const currentVal = typeof numericVal === 'number' ? numericVal : min;
    const clampedVal = Math.min(Math.max(currentVal, min), max);

    // Map value to angle (-90deg at min to +90deg at max)
    const range = max - min || 1;
    const percent = (clampedVal - min) / range;
    const targetAngle = -90 + percent * 180;

    // Geometry calculations for SVG arcs (Center = (90, 75), Radius = 55)
    const cx = 90;
    const cy = 75;
    const radius = 55;

    const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        // Angle -90 is straight left, 0 is straight up, 90 is straight right
        const radians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
            x: centerX + r * Math.cos(radians),
            y: centerY + r * Math.sin(radians),
        };
    };

    const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(x, y, r, endAngle);
        const end = polarToCartesian(x, y, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
    };

    // Trigger sweep transition on mount and when targetAngle updates
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setNeedleAngle(targetAngle);
        });
        return () => cancelAnimationFrame(frame);
    }, [targetAngle]);

    return (
        <div className="relative flex flex-col items-center justify-center w-45 h-27.5 mx-auto select-none">
            <svg viewBox="0 0 180 100" className="w-full h-full overflow-visible">
                <defs>
                    {/* Subtle Glow Filter for Needle & Active Ticks */}
                    <filter id="gauge-glow" x="0" y="0" width="180" height="100" filterUnits="userSpaceOnUse">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Outer Background Track Arc */}
                <path
                    d={describeArc(cx, cy, radius, -90, 90)}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="8"
                    strokeLinecap="round"
                />

                {/* Color Zone Segments */}
                {zones.map((zone, idx) => {
                    const zMin = Math.min(Math.max(zone.min, min), max);
                    const zMax = Math.min(Math.max(zone.max, min), max);
                    const startDeg = -90 + ((zMin - min) / range) * 180;
                    const endDeg = -90 + ((zMax - min) / range) * 180;

                    if (startDeg >= endDeg) return null;

                    return (
                        <path
                            key={`zone-${idx}`}
                            d={describeArc(cx, cy, radius, startDeg, endDeg)}
                            fill="none"
                            stroke={zone.color}
                            strokeWidth="6"
                            strokeOpacity="0.75"
                        />
                    );
                })}

                {/* Render Dynamic Ticks & Labels */}
                {ticks.map((tick, idx) => {
                    const tickPct = ticks.length > 1 ? idx / (ticks.length - 1) : 0;
                    const tickDeg = -90 + tickPct * 180;
                    const pInner = polarToCartesian(cx, cy, radius - 6, tickDeg);
                    const pOuter = polarToCartesian(cx, cy, radius + 2, tickDeg);
                    const pLabel = polarToCartesian(cx, cy, radius - 15, tickDeg);

                    return (
                        <g key={`tick-${idx}`}>
                            <line
                                x1={pInner.x}
                                y1={pInner.y}
                                x2={pOuter.x}
                                y2={pOuter.y}
                                stroke="rgba(255,255,255,0.35)"
                                strokeWidth="1.5"
                            />
                            <text
                                x={pLabel.x}
                                y={pLabel.y}
                                fill="rgba(255,255,255,0.5)"
                                fontSize="7"
                                fontFamily="monospace"
                                textAnchor="middle"
                                dominantBaseline="central"
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

                {/* Needle Indicator */}
                <g
                    style={{
                        transform: `rotate(${needleAngle}deg)`,
                        transformOrigin: `${cx}px ${cy}px`,
                        transition: 'transform 1s ease',
                    }}
                >
                    {/* Main Pointer Line */}
                    <line
                        x1={cx}
                        y1={cy}
                        x2={cx}
                        y2={cy - radius + 8}
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        filter="url(#gauge-glow)"
                    />

                    {/* Center Pivot Dots */}
                    <circle cx={cx} cy={cy} r="5" fill={color} />
                    <circle cx={cx} cy={cy} r="2.5" fill="#0f172a" />
                </g>
            </svg>

            {/* Digital Value Readout Box */}
            <div
                className="text-xs font-mono font-bold tracking-wider -mt-3 px-2.5 py-0.5 rounded bg-slate-900/90 border border-white/10 shadow-lg"
                style={{ color: color }}
            >
                {value}
            </div>
        </div>
    );
};