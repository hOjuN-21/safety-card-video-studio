/**
 * tts-engine.js (V2.4 Guaranteed Audio Embedding Engine)
 * Multi-Gateway Audio Buffer Fetcher + Base64 Decoder + Mic Recording + Web Speech
 */

class TTSEngine {
  constructor() {
    this.audioCtx = null;
    this.customBgmBuffer = null;
    this.customBgmName = "";
    this.ttsBufferCache = new Map();
    this.mediaRecorder = null;
    this.recordedAudioChunks = [];
    this.isRecordingMic = false;
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

  getBestVoice() {
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    const koVoices = voices.filter(v => v.lang && (v.lang.startsWith('ko') || v.lang.includes('KR') || v.name.includes('Korean') || v.name.includes('한국어')));

    const preferred = koVoices.find(v => 
      v.name.includes('SunHi') || v.name.includes('Heami') || v.name.includes('Female') || 
      v.name.includes('여성') || v.name.includes('Yuna') || v.name.includes('Google') || v.name.includes('혜미')
    );
    if (preferred) return preferred;

    return koVoices[0] || voices[0] || null;
  }

  speak(text, rate = 1.0, onEnd = null) {
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

      const voice = this.getBestVoice();
      if (voice) utterance.voice = voice;

      utterance.pitch = 1.05;
      utterance.rate = rate;

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
   * Fetch and decode real speech AudioBuffer with multi-strategy fallbacks
   */
  async getTTSAudioBuffer(text, rate = 1.0) {
    if (!text || text.trim() === '') return null;
    const cleanText = text.trim();
    const cacheKey = `${cleanText}_${rate}`;

    if (this.ttsBufferCache.has(cacheKey)) {
      return this.ttsBufferCache.get(cacheKey);
    }

    const ctx = this.getAudioContext();
    let rawBuffer = null;

    const encoded = encodeURIComponent(cleanText);
    const gtxUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=ko&q=${encoded}`;
    const twUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=${encoded}`;

    // Strategy 1: AllOrigins raw & JSON mode
    try {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(gtxUrl)}`, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        if (ab && ab.byteLength > 200) {
          rawBuffer = await ctx.decodeAudioData(ab);
        }
      }
    } catch (e) {}

    // Strategy 2: AllOrigins JSON Base64 mode
    if (!rawBuffer) {
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(gtxUrl)}`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const json = await res.json();
          if (json.contents && json.contents.startsWith('data:')) {
            const dataRes = await fetch(json.contents);
            const ab = await dataRes.arrayBuffer();
            if (ab && ab.byteLength > 200) {
              rawBuffer = await ctx.decodeAudioData(ab);
            }
          }
        }
      } catch (e) {}
    }

    // Strategy 3: CorsProxy.io
    if (!rawBuffer) {
      try {
        const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(gtxUrl)}`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 200) {
            rawBuffer = await ctx.decodeAudioData(ab);
          }
        }
      } catch (e) {}
    }

    // Strategy 4: Codetabs proxy
    if (!rawBuffer) {
      try {
        const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(twUrl)}`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 200) {
            rawBuffer = await ctx.decodeAudioData(ab);
          }
        }
      } catch (e) {}
    }

    // Strategy 5: Direct Google TTS
    if (!rawBuffer) {
      try {
        const res = await fetch(gtxUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 200) {
            rawBuffer = await ctx.decodeAudioData(ab);
          }
        }
      } catch (e) {}
    }

    // Fallback: If network proxies are offline, create clear melodic safety chime carrier
    if (!rawBuffer) {
      console.warn("Using melodic carrier buffer for:", cleanText.slice(0, 15));
      rawBuffer = this.createNotificationChimeBuffer(cleanText, rate);
    }

    this.ttsBufferCache.set(cacheKey, rawBuffer);
    return rawBuffer;
  }

  createNotificationChimeBuffer(text, rate = 1.0) {
    const ctx = this.getAudioContext();
    const sr = ctx.sampleRate;
    const dur = this.estimateDuration(text, rate);
    const buffer = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const data = buffer.getChannelData(0);

    const chimeDur = 0.4;
    const chimeSamples = Math.floor(sr * chimeDur);
    for (let i = 0; i < chimeSamples && i < data.length; i++) {
      const t = i / sr;
      const freq = 659.25; // E5 tone
      const env = Math.exp(-t * 8);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.15;
    }

    return buffer;
  }

  /**
   * Card-level Microphone Audio Recording
   */
  async startMicRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recordedAudioChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recordedAudioChunks.push(e.data);
    };
    this.mediaRecorder.start();
    this.isRecordingMic = true;
  }

  async stopMicRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error("녹음이 진행 중이지 않습니다."));
      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedAudioChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = this.getAudioContext();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          this.isRecordingMic = false;
          resolve({ blob, audioBuffer, duration: audioBuffer.duration });
        } catch (err) {
          reject(err);
        }
      };
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    });
  }

  /**
   * Load custom audio file for a card or BGM
   */
  async decodeAudioFile(file) {
    if (!file) return null;
    const ctx = this.getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return decoded;
  }

  async loadCustomBgm(file) {
    const decoded = await this.decodeAudioFile(file);
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
          sampleL += sine * lfo * 0.06;
          sampleR += Math.sin(2 * Math.PI * (f * 1.003) * t) * lfo * 0.06;
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

        const pulse = Math.sin(2 * Math.PI * f * t) * decay * 0.08;
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

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
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
