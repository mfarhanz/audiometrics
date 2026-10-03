export const DESCRIPTOR_DEFINITIONS: Record<string, string> = {
    // Low-End & Bass
    "sub bass": "Dominant low-frequency energy below 120 Hz with heavy sub-harmonics (vibrating like deep 808s or synth sub-drops).",
    "rumbling": "Sustained sub-bass resonance with a strong negative spectral slope (continuous low-end vibration, like distant thunder or low engine hum).",
    "deep": "Substantial low-frequency weight centered in the 60 Hz to 250 Hz range (low yet clear musical notes, like a bass guitar or low organ pedal).",
    "heavy bass": "High-RMS low-end profile extending up through 1.5 kHz (dense, mix-dominating low end typical of club tracks or heavy synth bass).",
    "punchy": "Fast transient attack in the mid-bass band between 80 Hz and 190 Hz (gives a sharp, immediate hit to the chest, like a tight kick drum or slap bass).",
    "boomy": "Prolonged low-end resonance and wide frequency dispersion (like a lingering, echoing low-end build-up inside a room or cabinet).",

    // Pitch, Tune & Harmonic Structure
    "noisy": "High spectral flatness and low crest factor (ike white noise or heavy snare wire rattle).",
    "unpitched transients": "High-frequency percussive bursts with noise-like spectral distribution (sharp clicks, rimshots, or metallic percussion without a clear musical pitch).",
    "pure tone": "Narrow spectral focus with minimal harmonic overtones (a clean sine wave sound, like a tuning fork or test oscillator).",
    "resonant": "Prominent fundamental harmonic peaks relative to surrounding frequencies (a ringing quality, like a synth filter swept at high resonance).",
    "polyphonic texture": "Complex multi-note harmonic structure across mid-frequency bands (multiple overlapping musical pitches, like a dense pad or chord progression).",
    "gliding": "Rapid spectral flux shifts paired with strong tonal pitch movement (smooth pitch slides, like an 808 pitch glide or portamento synth lead).",
    "dissonant": "Wide spectral spread with competing, non-harmonic frequency peaks (clashing frequencies that create harsh ringing, like a ring modulator or trashy cymbal).",

    // Dynamics & Envelope
    "dynamic": "Wide difference between peak transients and average RMS level above 18.5 dB (large volume jumps between quiet passages and loud hits, typical of uncompressed live acoustic recordings).",
    "lively": "Balanced dynamic envelope with punchy transient peaks and healthy headroom (feels energetic and uncompressed without sounding squashed).",
    "dense": "Sustained high loudness with compressed dynamic range and minimal decay (a wall-of-sound effect where everything sits at maximum volume).",
    "compressed": "Heavy dynamic limiting resulting in narrow peak-to-RMS variance (volume levels are squeezed flat, like a track pushed through a brickwall limiter).",
    "front-loaded": "Energy concentrated heavily at the start of the audio sample (a loud initial hit or crash that quickly decays).",
    "crescendo": "Energy build-up concentrated towards the tail of the audio sample (swelling volume build-up over time).",

    // Timbre & Spectrum
    "airy": "Extensive high-frequency extension above 9 kHz with smooth spectral flux.",
    "crisp": "High spectral centroid above 3.8 kHz with sharp high-frequency transient detail (clearly defined percussive hits like snaps and hi-hats).",
    "bright": "Strong high-frequency emphasis with roll-off exceeding 6 kHz (a forward, sharp treble bias that cuts through a mix).",
    "clear midrange": "Balanced energy distribution focused cleanly in the 1.8 kHz to 2.8 kHz band (distinguishable vocal presence and instrument body).",
    "warm": "Rich low-mid response between 1.2 kHz and 1.8 kHz with attenuated upper highs (mellow sounding or rounded tone characteristic similar to vintage tape).",
    "dark": "Attenuated high frequencies with spectral centroid focused below 1.2 kHz (a muted, warm tone with minimal treble cut).",
    "muffled": "Severe high-frequency attenuation with spectral roll-off below 2.5 kHz (sounds like listening through a blanket or wall).",
    "broadband": "Wide frequency distribution spanning across the audible spectrum (covers sub, mids, and highs evenly).",
    "narrowband": "Energy constrained within a narrow frequency bandwidth (sounds focused into a tight band, like a telephone filter).",

    // Transients, Rhythm & Tempo
    "sharp transients": "High envelope kurtosis with intense initial attack spikes (fast, cutting transient impacts like a woodblock or sharp rimshot).",
    "percussive": "Prominent transient impulse activity relative to sustained body (driven by rhythmic hits rather than sustained chords or pads).",
    "sustained": "Smooth, continuous amplitude envelope with minimal transient flux (drawn-out, lingering sound like an organ pad or bowed string).",
    "up-tempo": "Fast rhythmic pulse detected above 142 BPM (driving pace typical of drum and bass, techno, or fast rock).",
    "medium tempo": "Rhythmic pulse detected in the standard 100 to 141 BPM range (standard energetic dance, pop, or hip-hop pace).",
    "down-tempo": "Relaxed rhythmic pulse detected below 100 BPM (slow-paced groove typical of lofi, dub, or chillout tracks).",
    "ambient": "Low spectral flux and squashed crest factor (smooth, beatless texture typical of atmospheric synth pads and background soundscapes).",

    // Vibe, Mood & Genre
    "industrial": "Distorted, high-kurtosis harmonic noise with aggressive drive (harsh metallic textures and overdriven synthesizer hits).",
    "aggressive": "High loudness, saturation, and flux combined with fast tempo (intense, driving audio pushing hard into the red).",
    "heavy": "Driven saturation paired with high dynamic headroom (thick, weighted sound with strong distorted low-mids).",
    "abrasive": "Saturated high frequencies with harsh spectral distribution (rough, biting high-end content that cuts aggressively).",
    "piercing": "Intense energy localized in the highly sensitive 4 kHz+ frequency band (sharp high frequencies that cause ear fatigue).",
    "energetic": "High spectral flux and overall signal power at rapid tempo (packed with rhythmic movement and high peak energy).",
    "groovy": "Rhythmic bounce within 112 to 128 BPM with high transient dynamics (danceable tempo with clear rhythmic push-and-pull).",
    "upbeat vibrant": "Bright tonal profile combined with driving tempo and low distortion (clean, lively track with strong high-end clarity).",
    "hypnotic": "Repetitive rhythmic flux patterns with sustained dynamic levels (mesmerizing, steady groove that stays consistent over time).",
    "atmospheric": "Wide stereo spread, deep reverberant decay, and expansive dynamics (gives a feeling of large physical space or reverb halls).",
    "cinematic": "Wide spectral spread with dramatic crescendo energy buildup (big dramatic sound staging typical of film trailers or orchestral scores).",
    "ethereal": "Quiet, wide stereo imaging with delicate high-frequency energy (floating, airy texture with soft boundaries).",
    "moody": "Dark spectral profile with low overall energy and heavy low-mid focus (somber, subdued atmospheric tone).",
    "ominous": "Ultra-low spectral centroid with broad, unstable low-end noise (dark, tense low rumble that creates suspense).",
    "acoustic": "Clean, uncompressed signal with natural transient dynamics and high SDR (sounds like natural instruments recorded live in a room).",
    "meditative": "Ultra-quiet, smooth envelope with minimal flux or transient noise (calming, slow-moving sound for relaxed listening).",

    // Quality, Texture & Spatial Imaging
    "lo-fi": "Restricted frequency bandwidth and reduced signal-to-distortion ratio (gritty quality like old sampler hardware or cassette tape).",
    "vintage": "Warm high-end roll-off with subtle analog harmonic distortion (character typical of vinyl pressing or vintage console preamps).",
    "gritty": "Harmonic overdrive or light digital clipping along transient edges (subtle dirt and saturation on loud hits).",
    "heavy clipping": "Severe waveform peak truncation causing harsh digital distortion (the signal is pushed past 0 dBFS causing hard-edge shearing).",
    "noise floor": "Elevated background noise floor with low signal-to-distortion ratio below 18 dB (noticeable tape hiss, room noise, or analog hum).",
    "hazy quality": "Moderate background noise floor with softened transient edges (slightly veiled clarity without full clipping).",
    "pristine": "High SDR above 58 dB, zero clipping, and clean dynamic range (ultra-clean digital master with zero background noise).",
    "mono": "Single-channel audio or zero stereo width (plays identically out of left and right speakers).",
    "out-of-phase": "Negative stereo correlation indicating phase cancellation risks (wide side content that can disappear when collapsed to mono).",
    "diffused": "Wide, ambient stereo spread with low center-channel phase correlation (sounds wrapped around the listener rather than focused in the middle).",
    "wide stereo imaging": "Balanced stereo width with distinct left/right channel separation (clear spatial placement across the left and right speakers).",
    "centered": "High stereo correlation above 0.85 (audio stays tightly focused in the middle of the mix, like a solo vocal or bass).",
    "vague": "Unclassified or neutral acoustic characteristics (balanced audio profile with no extreme frequency or dynamic bias).",
};
