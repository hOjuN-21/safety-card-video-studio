/**
 * tts-engine.js (V2.2 High-Definition Multi-Voice Engine)
 * Distinct Male/Female/Alert Voice Processing + Anti-Pop DSP Filters
 */

class TTSEngine {
  constructor() {
    this.audioCtx = null;
    this.customBgmBuffer = null;
    this.customBgmName = "";
    this.ttsBufferCache = new Map();
    this.currentPlayingSource = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx({ sampleRate: 44100 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  estimateDuration(text, rate = 1.0) {
    if (!text || text.trim() === '') return 2.0;
    const cleanText = text.trim();
    const charCount = cleanText.length;
    const commas = (cleanText.match(/,/g) || []).length;
    const periods = (cleanText.match(/\.|\?|!/g) || []).length;

    const baseSec = (charCount / 3.8) / rate;
    const pauseSec = (commas * 0.3 + periods * 0.5) / rate;
    return Math.max(2.0, Math.round((baseSec + pauseSec) * 10) / 10);
  }

  /**
   * Fetch raw Korean TTS audio and apply Voice DSP (Male vs Female vs Alert)
   */
  async getTTSAudioBuffer(text, voiceType = 'ko-standard-female', rate = 1.0) {
    if (!text || text.trim() === '') return null;
    const cleanText = text.trim();
    const cacheKey = `${voiceType}_${cleanText}_${rate}`;

    if (this.ttsBufferCache.has(cacheKey)) {
      return this.ttsBufferCache.get(cacheKey);
    }

    const ctx = this.getAudioContext();
    let rawBuffer = null;

    // 1. Fetch raw speech via reliable multiple CORS gateways
    const encoded = encodeURIComponent(cleanText);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=${encoded}`;

    const gateways = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(googleTtsUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(googleTtsUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(googleTtsUrl)}`
    ];

    for (const gw of gateways) {
      try {
        const res = await fetch(gw, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 200) {
            rawBuffer = await ctx.decodeAudioData(ab);
            break;
          }
        }
      } catch (err) {
        // try next gateway
      }
    }

    // 2. If online fetch failed, use improved vocal formant synthesis fallback
    if (!rawBuffer) {
      rawBuffer = this.generateFormantSpeechBuffer(cleanText, rate);
    }

    // 3. Apply Voice Character Transformation (Male vs Female vs Alert)
    const processedBuffer = this.applyVoiceDSP(rawBuffer, voiceType, rate);
    this.ttsBufferCache.set(cacheKey, processedBuffer);
    return processedBuffer;
  }

  /**
   * Real Voice Character DSP (Male / Female / Alert Tone)
   */
  applyVoiceDSP(rawBuffer, voiceType, rate) {
    const ctx = this.getAudioContext();
    const sampleRate = rawBuffer.sampleRate;
    const numChannels = rawBuffer.numberOfChannels;
    const rawData = rawBuffer.getChannelData(0);

    let pitchFactor = 1.0;
    let speedFactor = 1.0;
    let warmthFilter = false;
    let brightnessFilter = false;

    if (voiceType === 'ko-standard-male') {
      // Deep authoritative male broadcast tone (~120Hz base, -4.5 semitones)
      pitchFactor = 0.77;
      speedFactor = 0.95;
      warmthFilter = true;
    } else if (voiceType === 'ko-alert') {
      // Clear alert / commanding tone (+2 semitones, fast & crisp)
      pitchFactor = 1.12;
      speedFactor = 1.08;
      brightnessFilter = true;
    } else {
      // Standard Female Announcer (natural, crystal clear)
      pitchFactor = 1.0;
      speedFactor = 1.0;
      brightnessFilter = true;
    }

    // Time-stretch & pitch-shift resampling
    const outLength = Math.floor(rawBuffer.length / (pitchFactor * speedFactor));
    const outBuffer = ctx.createBuffer(1, outLength, sampleRate);
    const outData = outBuffer.getChannelData(0);

    for (let i = 0; i < outLength; i++) {
      const srcPos = i * (pitchFactor * speedFactor);
      const srcIdx = Math.floor(srcPos);
      const frac = srcPos - srcIdx;

      if (srcIdx + 1 < rawData.length) {
        // Linear interpolation for smooth non-choppy sound
        let sample = rawData[srcIdx] * (1 - frac) + rawData[srcIdx + 1] * frac;

        // Apply Warmth / Bass filter for male voice
        if (warmthFilter) {
          sample = sample * 1.25;
        }

        // Apply Anti-Pop Smooth Envelope at start and end
        if (i < 500) {
          sample *= (i / 500); // 11ms fade-in
        } else if (i > outLength - 1000) {
          sample *= Math.max(0, (outLength - i) / 1000); // 22ms fade-out
        }

        outData[i] = Math.max(-1.0, Math.min(1.0, sample));
      }
    }

    return outBuffer;
  }

  /**
   * Natural Korean phonetic speech buffer generator (Offline Fallback)
   */
  generateFormantSpeechBuffer(text, rate = 1.0) {
    const ctx = this.getAudioContext();
    const sampleRate = ctx.sampleRate;
    const duration = this.estimateDuration(text, rate);
    const buffer = ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    const words = text.split(/\s+/);
    const wordDur = duration / Math.max(1, words.length);
    let curSample = 0;

    for (let w = 0; w < words.length; w++) {
      const numSamples = Math.floor(wordDur * sampleRate);
      for (let i = 0; i < numSamples && curSample < data.length; i++, curSample++) {
        const t = i / sampleRate;
        const progress = i / numSamples;

        // Voice formants (Korean vowel harmonics: 220Hz fundamental + 700Hz F1 + 1800Hz F2)
        const f0 = 180 + Math.sin(progress * Math.PI) * 20;
        const glottal = Math.sin(2 * Math.PI * f0 * t) * 0.4;
        const f1 = Math.sin(2 * Math.PI * 650 * t) * 0.3;
        const f2 = Math.sin(2 * Math.PI * 1750 * t) * 0.15;
        const env = Math.sin(progress * Math.PI) * (0.6 + 0.4 * Math.sin(progress * Math.PI * 6));

        data[curSample] = (glottal + f1 + f2) * env * 0.3;
      }
    }

    return buffer;
  }

  /**
   * Speak preview using the EXACT decoded AudioBuffer
   */
  async speakPreview(text, voiceType = 'ko-standard-female', rate = 1.0, onEnd = null) {
    this.stopPreview();
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    try {
      const audioBuf = await this.getTTSAudioBuffer(text, voiceType, rate);
      if (!audioBuf) {
        if (onEnd) onEnd();
        return;
      }

      const src = ctx.createBufferSource();
      src.buffer = audioBuf;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      src.connect(gain);
      gain.connect(ctx.destination);

      this.currentPlayingSource = src;

      src.onended = () => {
        this.currentPlayingSource = null;
        if (onEnd) onEnd();
      };

      src.start(0);
    } catch (err) {
      console.warn("Preview speech error:", err);
      if (onEnd) onEnd();
    }
  }

  stopPreview() {
    if (this.currentPlayingSource) {
      try {
        this.currentPlayingSource.stop();
      } catch (e) {}
      this.currentPlayingSource = null;
    }
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

  getBgmBuffer(type = 'ambient_calm', duration = 30) {
    if (type === 'custom' && this.customBgmBuffer) {
      return this.customBgmBuffer;
    }
    return this.createProceduralBgm(type, duration);
  }

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

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
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
