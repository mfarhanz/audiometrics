import React from 'react';

interface PaletteManagerProps {
  barColors: string[];
  onChangeColors: (colors: string[]) => void;
}

export const PaletteManager: React.FC<PaletteManagerProps> = ({
  barColors,
  onChangeColors,
}) => {
  const handleAddColor = () => {
    if (barColors.length < 5) {
      onChangeColors([...barColors, '#38bdf8']);
    }
  };

  const handleColorChange = (index: number, newColor: string) => {
    const updated = [...barColors];
    updated[index] = newColor;
    onChangeColors(updated);
  };

  const handleRemoveColor = (index: number) => {
    if (barColors.length > 1) {
      onChangeColors(barColors.filter((_, i) => i !== index));
    }
  };

  const gradientPreview = {
    background:
      barColors.length > 1
        ? `linear-gradient(to right, ${barColors.join(', ')})`
        : barColors[0] || '#38bdf8',
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Label and Counter */}
      <label className="flex justify-between items-center text-[0.75rem] font-mono text-[var(--text-muted)]">
        <span>BAR PALETTE</span>
        <span className="val-badge font-bold text-[var(--accent)]">
          {barColors.length}/5
        </span>
      </label>

      {/* Live Gradient Bar Preview */}
      <div
        className="h-2 w-full rounded-full border border-white/10 shadow-inner transition-all duration-300"
        style={gradientPreview}
      />

      {/* Color Pills & Actions Container */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {barColors.map((color, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-2 py-1 shadow-sm transition-colors hover:border-white/20"
          >
            {/* Color Swatch Circle (Acts as Native Color Picker trigger) */}
            <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 border border-white/20 shadow-inner">
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(idx, e.target.value)}
                className="absolute -top-2 -left-2 w-9 h-9 cursor-pointer opacity-0"
              />
              <div
                className="w-full h-full pointer-events-none"
                style={{ backgroundColor: color }}
              />
            </div>

            {/* Hex Color Code Display */}
            <span className="font-mono text-[0.7rem] font-bold text-white tracking-wider uppercase">
              {color}
            </span>

            {/* Visible Minus/Remove Button */}
            {barColors.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveColor(idx)}
                className="w-4 h-4 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-red-500/80 transition-all flex items-center justify-center text-[12px] font-bold leading-none ml-0.5"
                title="Remove color"
              >
                −
              </button>
            )}
          </div>
        ))}

        {/* Plus Pill Button (Hides at 5 colors) */}
        {barColors.length < 5 && (
          <button
            type="button"
            onClick={handleAddColor}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-white/20 bg-white/5 text-white/70 hover:text-white hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all text-[15px] font-bold leading-none"
            title="Add Color"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
};
