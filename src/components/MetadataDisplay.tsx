import React from 'react';
import type { MetadataRow } from '../types/metadata';

interface MetadataDisplayProps {
  rows: MetadataRow[];
  descriptors?: string;
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
  // 1. Show Error State
  if (isError) {
    return <div className="meta-placeholder error">{placeholderText || 'An error occurred while analyzing metadata.'}</div>;
  }

  // 2. Show Empty or Loading State (when no rows are computed yet)
  if (!rows || rows.length === 0) {
    return <div className="meta-placeholder">{placeholderText || 'Load an audio file to view metadata.'}</div>;
  }

  return (
    <div className="metadata-display-content">
      {/* Audio Summary / Descriptors Badge */}
      {descriptors && (
        <div className="audio-descriptors-summary">
          <strong>Profile:</strong> {descriptors}
        </div>
      )}

      {/* Progressive loading indicator banner while rows are still streaming in */}
      {isLoading && (
        <div className="meta-loading-banner">
          <span>{placeholderText || 'Analyzing deeper audio features...'}</span>
        </div>
      )}

      {/* Metadata Table */}
      <table className="metadata-table">
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.label}-${idx}`}>
              <td className="meta-label">
                {row.label}
                {row.info && (
                  <span className="meta-info-icon" title={row.info}>
                    ℹ️
                  </span>
                )}
              </td>
              <td 
                className="meta-value"
                style={row.color ? { color: row.color, fontWeight: 'bold' } : undefined}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};