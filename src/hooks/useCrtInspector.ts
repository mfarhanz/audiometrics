import { useState, useEffect, useRef } from 'react';

export type CrtState = 'OFF' | 'DOT' | 'LINE' | 'OPEN';

export function useCrtInspector(activeInfo: string | null) {
    const [crtState, setCrtState] = useState<CrtState>('OFF');
    const [displayedText, setDisplayedText] = useState<string>('');

    const hoverDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animSequenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimers = () => {
        if (hoverDebounceTimer.current) clearTimeout(hoverDebounceTimer.current);
        if (animSequenceTimer.current) clearTimeout(animSequenceTimer.current);
    };

    useEffect(() => {
        clearTimers();

        if (activeInfo) {
            // 1. Trigger initial TV Ignition Dot
            setTimeout(() => {
                setCrtState((prev) => (prev === 'OFF' ? 'DOT' : prev));
            }, 0);

            // 2. Expand Dot into Horizontal Scanline
            animSequenceTimer.current = setTimeout(() => {
                setCrtState('LINE');

                // 3. Debounce: Only expand full screen and show text if cursor rests on item
                hoverDebounceTimer.current = setTimeout(() => {
                    setDisplayedText(activeInfo);
                    setCrtState('OPEN');
                }, 180); // Rest delay threshold before full text reveal
            }, 80); // Dot-to-line ignition duration

        } else {
            // Begin Reverse Collapse sequence (OPEN -> LINE -> DOT -> OFF)
            setTimeout(() => {
                setCrtState((prev) => (prev === 'OPEN' ? 'LINE' : prev));
            }, 0);

            animSequenceTimer.current = setTimeout(() => {
                setCrtState('DOT');

                animSequenceTimer.current = setTimeout(() => {
                    setCrtState('OFF');
                    setDisplayedText('');
                }, 120); // Dot collapse duration
            }, 150); // Vertical scanline collapse duration
        }

        return () => clearTimers();
    }, [activeInfo]);

    return { crtState, displayedText };
}
