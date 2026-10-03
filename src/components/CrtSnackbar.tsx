import React from 'react';
import { useCrtInspector } from '../hooks/useCrtInspector'; // Adjust path as needed

export interface CrtSnackbarProps {
  /** The text or message content to render inside the CRT display */
  text: string | null;
  /** Optional custom icon (defaults to 🛈) */
  icon?: React.ReactNode;
  /** Optional click handler if you want the popup to be actionable */
  onClick?: () => void;
}

export const CrtSnackbar: React.FC<CrtSnackbarProps> = ({
  text,
  icon = '🛈',
  onClick,
}) => {
  const { crtState, displayedText } = useCrtInspector(text);

  return (
    <div
      onClick={onClick}
      className={`crt-inspector-dock crt-state-${crtState.toLowerCase()}`}
    >
      {/* Center Cathode Glow Flash Dot */}
      <div className="crt-glow-dot" />

      {/* Screen Content */}
      <div className="crt-screen">
        <span className="crt-icon">{icon}</span>
        <span className="crt-text">{displayedText}</span>
      </div>
    </div>
  );
};
