import React from 'react';
import type { MetadataRow } from '../types/metadata';

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
    // Show Error State
    if (isError) {
        return <div className="placeholder-text error-text">{placeholderText || 'An error occurred while analyzing metadata.'}</div>;
    }

    // Otherwise show Empty or Loading State (when no rows are computed yet)
    if (!rows || rows.length === 0) {
        return <div className="placeholder-text">{placeholderText || 'Load an audio file to view metadata.'}</div>;
    }

    return (
        <div className="metadata-display placeholder-text">
            {/* Audio Summary / Descriptors Badge */}
            {descriptors && descriptors.length > 0 && (
                <div className="audio-summary">
                    <strong className="audio-summary-label">Profile:</strong>
                    <div className="summary-pill-group">
                        {descriptors.map((desc, idx) => (
                            <span
                                key={`${desc}-${idx}`}
                                className={`summary-pill pill-color-${idx % 5}`}
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

            {/* Metadata Table */}
            <div className="grid-table">
                {rows.map((row, idx) => (
                    <div key={`${row.label}-${idx}`} className="grid-row">
                        <div className="grid-cell-group">
                            <div className="grid-key">{row.label}</div>
                            <div
                                className="grid-val"
                                style={row.color ? { color: row.color } : undefined}
                            >
                                {row.value}
                            </div>
                        </div>

                        {row.info && (
                            <div className="info-drawer">
                                <div className="info-drawer-content">
                                    <span className="info-icon">🛈</span> {row.info}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
