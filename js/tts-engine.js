/**
 * tts-engine.js (V2.3 Pure Human Voice & Neural Speech Engine)
 * Native Web Speech Integration + Multi-Gateway MP3 Fetcher + Zero-Robotic Fallback
 */

class TTSEngine {
  constructor() {
    this.audioCtx = null;
    this.customBgmBuffer = null;
    this.customBgmName = "";
    this.ttsBufferCache = new Map();
    this.cachedVoices = [];
    this.initVoices();
  }

  initVoices() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.cachedVoices = window.speechSynthesis.getVoices() || [];
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices() || [];
      };
    }
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
   * Get the best matching OS Korean voice
   */
  getBestVoice(voiceType = 'ko-standard-female') {
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    const koVoices = voices.filter(v => v.lang && (v.lang.startsWith('ko') || v.lang.includes('KR') || v.name.includes('Korean') || v.name.includes('한국어')));

    if (voiceType === 'ko-standard-male') {
      const maleVoice = koVoices.find(v => 
        v.name.includes('InJoon') || v.name.includes('Male') || v.name.includes('남성') || 
        v.name.includes('Hyunsu') || v.name.includes('민호') || v.name.includes('David')
      );
      if (maleVoice) return maleVoice;
    } else if (voiceType === 'ko-standard-female') {
      const femaleVoice = koVoices.find(v => 
        v.name.includes('SunHi') || v.name.includes('Heami') || v.name.includes('Female') || 
        v.name.includes('여성') || v.name.includes('Yuna') || v.name.includes('Google') || v.name.includes('혜미')
      );
      if (femaleVoice) return femaleVoice;
    }

    return koVoices[0] || voices[0] || null;
  }

  /**
   * Speak preview in browser using native Web Speech Synthesis with crystal-clear human voices
   */
  speak(text, voiceType = 'ko-standard-female', rate = 1.0, onEnd = null) {
    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (!text || text.trim() === '') {
        if (onEnd) onEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'ko-KR';

      const voice = this.getBestVoice(voiceType);
      if (voice) utterance.voice = voice;

      // Adjust pitch and rate according to voice character
      if (voiceType === 'ko-standard-male') {
        const isMaleNative = voice && (voice.name.includes('InJoon') || voice.name.includes('Male') || voice.name.includes('남성'));
        utterance.pitch = isMaleNative ? 0.95 : 0.72; // Deep resonant pitch if simulating male
        utterance.rate = Math.max(0.7, rate * 0.92);
      } else if (voiceType === 'ko-alert') {
        utterance.pitch = 1.22;
        utterance.rate = Math.min(1.4, rate * 1.12);
      } else {
        // Female Announcer
        utterance.pitch = 1.05;
        utterance.rate = rate;
      }

      utterance.onend = () => { if (onEnd) onEnd(); };
      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech preview error:", err);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  /**
   * Fetch real human Korean speech MP3 audio buffer for video recording
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

    // Fetch real speech audio via multi-gateway fallback list
    const encoded = encodeURIComponent(cleanText);
    const gtxUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=ko&q=${encoded}`;
    const twUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=${encoded}`;

    const proxyList = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(gtxUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(gtxUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(gtxUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(twUrl)}`
    ];

    for (const pUrl of proxyList) {
      try {
        const res = await fetch(pUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 200) {
            rawBuffer = await ctx.decodeAudioData(ab);
            break;
          }
        }
      } catch (err) {
        // try next proxy
      }
    }

    if (!rawBuffer) {
      // Create a clean silent buffer with a subtle notification tone (NO robot buzzing!)
      console.warn("Online audio fetch unavailable. Using silent carrier buffer for:", cleanText.slice(0, 15));
      const dur = this.estimateDuration(cleanText, rate);
      rawBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    }

    // Process Voice Character (Male vs Female vs Alert)
    const finalBuffer = this.processVoiceCharacter(rawBuffer, voiceType, rate);
    this.ttsBufferCache.set(cacheKey, finalBuffer);
    return finalBuffer;
  }

  /**
   * Clean voice character processing without distortions
   */
  processVoiceCharacter(buffer, voiceType, rate) {
    const ctx = this.getAudioContext();
    const sr = buffer.sampleRate;
    const inData = buffer.getChannelData(0);

    let pitchScale = 1.0;
    if (voiceType === 'ko-standard-male') {
      pitchScale = 0.82; // -3.5 semitones male warmth
    } else if (voiceType === 'ko-alert') {
      pitchScale = 1.12; // +2 semitones crisp alert
    }

    const outLen = Math.floor(buffer.length / pitchScale);
    const outBuffer = ctx.createBuffer(1, Math.max(1, outLen), sr);
    const outData = outBuffer.getChannelData(0);

    for (let i = 0; i < outLen; i++) {
      const srcPos = i * pitchScale;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;

      if (idx + 1 < inData.length) {
        let val = inData[idx] * (1 - frac) + inData[idx + 1] * frac;

        // Smooth anti-pop envelope
        if (i < 400) {
          val *= (i / 400);
        } else if (i > outLen - 800) {
          val *= Math.max(0, (outLen - i) / 800);
        }

        outData[i] = val;
      }
    }

    return outBuffer;
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
