export const WINDOW_SIZES = [16, 32, 64, 128, 256, 512, 800, 1024, 1600, 2048, 2400, 3200, 4096] as const;

export const BLEND_MODES = ['none', 'color-dodge', 'difference', 'exclusion', 'luminosity', 'overlay', 'xor'] as const;

export const SPECTRUM_BAR_STYLES = ['solid', 'segmented', 'dots', 'rounded', 'outline'] as const;

export const DEFAULT_CONFIG = {
    WINDOW_SIZE: 1024,
    SAMPLE_SKIP: 9,
    WAVE_THICKNESS: 2,
    WAVE_SMOOTHING: false,
    FREQUENCY_COUNT: 512,
    FREQUENCY_BAR_GAP: 1.5,
    FREQUENCY_BAR_DENSITY: 1.0,
    OSCILLOSCOPE_BACKGROUND: '#1f3626',
    SPECTRUM_VISUALIZER_BACKGROUND: '#0c1533',
    SECONDARY_WAVE_OPACITY: 0.5,
    WAVE_BACKGROUND: '#5ec7f4',
    SECONDARY_WAVE_BACKGROUND: '#f472b6',
    GLOW_COLOR: '#38bdf8',
    FREQUENCY_BAR_COLORS: ['#10b981', '#38bdf8'],
    FREQUENCY_BAR_STYLE: 'solid',
    SHOW_OSCILLOSCOPE_GRID: false,
    OSCILLOSCOPE_GRID_COLOR: '#4ade80',
    OSCILLOSCOPE_GRID_X_DIVISIONS: 16,
    OSCILLOSCOPE_GRID_Y_DIVISIONS: 6,
    OSCILLOSCOPE_GRID_SUBDIVISIONS: 3,
    WAVE_BLEND_MODE: undefined,
} as const;
