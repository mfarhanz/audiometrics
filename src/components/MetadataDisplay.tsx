import React, { useState } from 'react';
import type { MetadataRow } from '../types/metadata';
import { MetricGauge } from './MetricGauge';
import { CrtSnackbar } from './CrtSnackbar';
import { DESCRIPTOR_DEFINITIONS } from '../data/definitions';

interface MetadataDisplayProps {
    rows: MetadataRow[];
    descriptors?: string[];
    placeholderText?: string;
    isLoading?: boolean;
    isError?: boolean;
}

export const MetadataDisplay: React.FC<MetadataDisplayProps> = ({
    rows,
    descriptors,
    placeholderText,
    isLoading,
    isError,
}) => {
    const [activeHoveredInfo, setActiveHoveredInfo] = useState<string | null>(null);

    // Show Error State
    if (isError) {
        return <div className="placeholder-text error-text">{placeholderText || 'An error occurred while analyzing metadata.'}</div>;
    }

    // Show Empty State ONLY if not loading and no rows exist yet
    if (!isLoading && (!rows || rows.length === 0)) {
        return <div className="placeholder-text flex justify-center">{placeholderText || 'Load an audio file to view metadata.'}</div>;
    }

    return (
        <div className="metadata-display select-none">
            {/* Audio Summary / Descriptors Badge */}
            {descriptors && descriptors.length > 0 && (
                <div className="audio-summary">
                    <strong className="audio-summary-label">Remarks</strong>
                    <div className="summary-pill-group">
                        {descriptors.map((desc, idx) => (
                            <span
                                key={`${desc}-${idx}`}
                                className={`summary-pill pill-color-${idx % 5}`}
                                onMouseEnter={() => setActiveHoveredInfo(DESCRIPTOR_DEFINITIONS[desc.toLowerCase()])}
                                onMouseLeave={() => setActiveHoveredInfo(null)}
                            >
                                {desc}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Progressive loading indicator banner while rows are still streaming in */}
            {isLoading && (
                <div className="meta-loading">
                    <span className="loading-shimmer-text">
                        {placeholderText || 'Analyzing audio features...'}
                    </span>
                </div>
            )}

            {/* Flexible Adaptive Grid for Metric Cards */}
            <div className="meta-grid">
                {/* {rows.map((row, idx) => { */}
                {rows.map((row) => {
                    const isGaugeMetric = Boolean(row.gaugeConfig);

                    // Use placeholder values during track processing
                    const minVal = row.gaugeConfig?.min ?? 0;
                    const displayValue = isLoading ? "..." : row.value;
                    const numericValue = isLoading ? minVal : row.numericVal;

                    return (
                        <div
                            // key={`${row.label}-${idx}`}
                            key={row.label}
                            className={`metric-card ${isGaugeMetric ? 'gauge-card' : 'info-card'}`}
                            onMouseEnter={() => setActiveHoveredInfo(row.info || null)}
                            onMouseLeave={() => setActiveHoveredInfo(null)}
                        >
                            {isGaugeMetric ? (
                                <div className="gauge-card-inner">
                                    <MetricGauge
                                        // value={row.value}
                                        value={displayValue}
                                        // numericVal={row.numericVal}
                                        numericVal={numericValue}
                                        color={row.color || '#2ecc71'}
                                        min={row.gaugeConfig?.min}
                                        max={row.gaugeConfig?.max}
                                        ticks={row.gaugeConfig?.ticks}
                                        zones={row.gaugeConfig?.zones}
                                    />
                                    <div className="metric-label-group">
                                        <span className="metric-name">{row.label}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="info-card-inner">
                                    <div className="lcd-screen">
                                        <span className="lcd-value">{displayValue}</span>
                                    </div>
                                    <div className="metric-label-group">
                                        <span className="metric-name">{row.label}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <CrtSnackbar
                text={activeHoveredInfo}
            />
        </div>
    );
};
