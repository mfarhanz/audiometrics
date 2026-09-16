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

  return (
    <div className="palette-manager">
      <div className="color-swatches">
        {barColors.map((color, idx) => (
          <div key={idx} className="color-picker-item">
            <input
              type="color"
              value={color}
              onChange={(e) => handleColorChange(idx, e.target.value)}
            />
            {barColors.length > 1 && (
              <button className="remove-btn" onClick={() => handleRemoveColor(idx)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {barColors.length < 5 && (
        <button className="add-color-btn" onClick={handleAddColor}>
          + Add Color
        </button>
      )}
    </div>
  );
};
