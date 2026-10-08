import React from 'react';

export interface ToggleOption<T> {
  label: React.ReactNode;
  value: T;
  title?: string;
}

interface ToggleGroupProps<T> {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleGroup<T extends string | number | boolean>({
  options,
  value,
  onChange,
  className = '',
}: ToggleGroupProps<T>) {
  return (
    <div className={`toggle-group ${className}`.trim()}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            className={`toggle-btn ${isActive ? 'active' : ''}`}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
