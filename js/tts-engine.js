/**
 * tts-engine.js (V2.1 Audio Pro)
 * Real AudioBuffer TTS Fetcher, Speech Synthesis & Custom BGM Manager
 */

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.audioCtx = null;
    this.customBgmBuffer = null;
    this.customBgmName = "";
    this.ttsBufferCache = new Map();
    this.isSpeaking = false;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Estimate Korean speech duration in seconds
   */
  estimateDuration(text, rate = 1.0) {
    if (!text || text.trim() === '') return 2.0;
    const cleanText = text.trim();
    const charCount = cleanText.length;
    const commas = (cleanText.match(/,/g) || []).length;
    const periods = (cleanText.match(/\.|\?|!/g) || []).length;

    const baseSec = (charCount / 4.0) / rate;
    const pauseSec = (commas * 0.3 + periods * 0.5) / rate;
    return Math.max(2.0, Math.round((baseSec + pauseSec) * 10) / 10);
  }

  /**
   * Preview speech in browser
   */
  speak(text, rate = 1.0, pitch = 1.0, onEnd = null) {
    if (this.synth) {
      try {
        this.synth.cancel();
        if (!text || text.trim() === '') {
          if (onEnd) onEnd();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.lang = 'ko-KR';
        const voices = this.synth.getVoices() || [];
        const koVoice = voices.find(v => v.lang && (v.lang.includes('ko') || v.name.includes('Korean')));
        if (koVoice) utterance.voice = koVoice;

        utterance.onend = () => { if (onEnd) onEnd(); };
        utterance.onerror = () => { if (onEnd) onEnd(); };
        this.synth.speak(utterance);
      } catch (e) {
        if (onEnd) onEnd();
      }
    } else {
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.synth) {
      try { this.synth.cancel(); } catch (e) {}
    }
  }

  /**
   * Fetch real Korean TTS Audio as an AudioBuffer for video encoding
   */
  async getTTSAudioBuffer(text, rate = 1.0) {
    if (!text || text.trim() === '') return null;
    const cleanText = text.trim();
    const cacheKey = `${cleanText}_${rate}`;

    if (this.ttsBufferCache.has(cacheKey)) {
      return this.ttsBufferCache.get(cacheKey);
    }

    const ctx = this.getAudioContext();

    // 1. Try Google Translate TTS via fast public CORS proxies
    const encodedText = encodeURIComponent(cleanText);
    const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=${encodedText}`;

    const proxyUrls = [
      `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    for (const pUrl of proxyUrls) {
      try {
        const res = await fetch(pUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf && arrayBuf.byteLength > 100) {
            const decoded = await ctx.decodeAudioData(arrayBuf);
            this.ttsBufferCache.set(cacheKey, decoded);
            return decoded;
          }
        }
      } catch (err) {
        // try next proxy
      }
    }

    // 2. Fallback: Synthesize clean vocal audio buffer offline using Web Audio
    console.warn("Using offline synthesized speech buffer for:", cleanText.slice(0, 15));
    const fallbackBuffer = this.generateOfflineSpeechBuffer(cleanText, rate);
    this.ttsBufferCache.set(cacheKey, fallbackBuffer);
    return fallbackBuffer;
  }

  /**
   * Offline vocal formant synthesizer to guarantee non-empty audio even when offline
   */
  generateOfflineSpeechBuffer(text, rate = 1.0) {
    const ctx = this.getAudioContext();
    const sampleRate = ctx.sampleRate;
    const duration = this.estimateDuration(text, rate);
    const buffer = ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    const basePitch = 160; // Korean speech pitch ~160Hz
    const words = text.split(/\s+/);
    const wordDuration = duration / Math.max(1, words.length);

    let sampleIdx = 0;
    for (let w = 0; w < words.length; w++) {
      const wSamples = Math.floor(wordDuration * sampleRate);
      const isLast = (w === words.length - 1);

      for (let i = 0; i < wSamples && sampleIdx < data.length; i++, sampleIdx++) {
        const t = i / sampleRate;
        const progress = i / wSamples;

        // Intonation curve
        const pitchBend = isLast ? (1.0 - progress * 0.15) : (1.0 + Math.sin(progress * Math.PI) * 0.1);
        const f0 = basePitch * pitchBend;

        // Formant vocal synthesis (Vowel imitation F1=500Hz, F2=1500Hz, F3=2500Hz)
        const formant1 = Math.sin(2 * Math.PI * 500 * t) * 0.3;
        const formant2 = Math.sin(2 * Math.PI * 1500 * t) * 0.2;
        const formant3 = Math.sin(2 * Math.PI * 2500 * t) * 0.1;
        const voiceGlottal = Math.sin(2 * Math.PI * f0 * t) * 0.4;

        // Syllable pulsing envelope
        const sylPulse = Math.abs(Math.sin(progress * Math.PI * 4));
        const envelope = Math.sin(progress * Math.PI) * sylPulse;

        data[sampleIdx] = (voiceGlottal + formant1 + formant2 + formant3) * envelope * 0.35;
      }
    }

    return buffer;
  }

  /**
   * Load user custom BGM file
   */
  async loadCustomBgm(file) {
    if (!file) return null;
    const ctx = this.getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    this.customBgmBuffer = decoded;
    this.customBgmName = file.name;
    return decoded;
  }

  /**
   * Get BGM audio buffer (Custom or Procedural)
   */
  getBgmBuffer(type = 'ambient_calm', duration = 30) {
    if (type === 'custom' && this.customBgmBuffer) {
      return this.customBgmBuffer;
    }
    return this.createProceduralBgm(type, duration);
  }

  /**
   * Create procedural ambient safety BGM buffer
   */
  createProceduralBgm(type = 'ambient_calm', duration = 30) {
    const ctx = this.getAudioContext();
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    if (type === 'ambient_calm') {
      const freqs = [130.81, 164.81, 196.00, 246.94, 293.66];
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        let sampleL = 0;
        let sampleR = 0;

        freqs.forEach((f, idx) => {
          const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.12 * t + idx);
          const sine = Math.sin(2 * Math.PI * f * t);
          sampleL += sine * lfo * 0.08;
          sampleR += Math.sin(2 * Math.PI * (f * 1.003) * t) * lfo * 0.08;
        });

        let env = 1.0;
        if (t < 2.0) env = t / 2.0;
        if (t > duration - 3.0) env = Math.max(0, (duration - t) / 3.0);

        left[i] = sampleL * env;
        right[i] = sampleR * env;
      }
    } else if (type === 'focus_tech') {
      const freqs = [220, 277.18, 329.63, 440, 554.37];
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const beat = (t * 2) % 1;
        const decay = Math.exp(-beat * 6);
        const fIdx = Math.floor((t * 2) % freqs.length);
        const f = freqs[fIdx];

        const pulse = Math.sin(2 * Math.PI * f * t) * decay * 0.12;
        let env = 1.0;
        if (t < 1.0) env = t;
        if (t > duration - 2.0) env = Math.max(0, (duration - t) / 2.0);

        left[i] = pulse * env;
        right[i] = pulse * env;
      }
    }

    return buffer;
  }

  playChime(destNode = null) {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      if (destNode) gain.connect(destNode);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }
}

window.ttsEngine = new TTSEngine();
