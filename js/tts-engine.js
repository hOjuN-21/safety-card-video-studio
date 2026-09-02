/**
 * tts-engine.js (V3.0 Official Google Cloud TTS & Multi-Voice Engine)
 * Google Cloud Text-to-Speech (Neural2 & WaveNet) + Web Speech Synthesis + Mic Recording
 */

class TTSEngine {
  constructor() {
    this.audioCtx = null;
    this.customBgmBuffer = null;
    this.customBgmName = "";
    this.ttsBufferCache = new Map();
    this.googleApiKey = localStorage.getItem('google_tts_api_key') || "";
    this.mediaRecorder = null;
    this.recordedAudioChunks = [];
    this.isRecordingMic = false;
    this.cachedVoices = [];
    this.currentPlayingSource = null;
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

  setApiKey(key) {
    this.googleApiKey = (key || "").trim();
    if (this.googleApiKey) {
      localStorage.setItem('google_tts_api_key', this.googleApiKey);
    } else {
      localStorage.removeItem('google_tts_api_key');
    }
    this.ttsBufferCache.clear();
  }

  getApiKey() {
    return this.googleApiKey;
  }

  hasApiKey() {
    return !!(this.googleApiKey && this.googleApiKey.length > 10);
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

  getBestVoice(voiceName = 'ko-KR-Neural2-A') {
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    const koVoices = voices.filter(v => v.lang && (v.lang.startsWith('ko') || v.lang.includes('KR') || v.name.includes('Korean') || v.name.includes('한국어')));

    const isMale = voiceName && (voiceName.includes('-C') || voiceName.includes('-D') || voiceName.toLowerCase().includes('male'));

    if (isMale) {
      const maleVoice = koVoices.find(v => 
        v.name.includes('InJoon') || v.name.includes('Male') || v.name.includes('남성') || 
        v.name.includes('Hyunsu') || v.name.includes('민호') || v.name.includes('David')
      );
      if (maleVoice) return maleVoice;
    } else {
      const femaleVoice = koVoices.find(v => 
        v.name.includes('SunHi') || v.name.includes('Heami') || v.name.includes('Female') || 
        v.name.includes('여성') || v.name.includes('Yuna') || v.name.includes('Google') || v.name.includes('혜미')
      );
      if (femaleVoice) return femaleVoice;
    }

    return koVoices[0] || voices[0] || null;
  }

  /**
   * Preview speech audio in browser (using Google Cloud Neural2 buffer or native speech)
   */
  async speak(text, voiceName = 'ko-KR-Neural2-A', rate = 1.0, onEnd = null) {
    this.stop();
    const cleanText = (text || '').trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    // 1. If Google API key is available, fetch and play the authentic Google Neural2 voice buffer
    if (this.hasApiKey()) {
      try {
        const audioBuf = await this.getTTSAudioBuffer(cleanText, voiceName, rate);
        if (audioBuf) {
          const ctx = this.getAudioContext();
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          this.currentPlayingSource = src;
          src.onended = () => {
            this.currentPlayingSource = null;
            if (onEnd) onEnd();
          };
          src.start();
          return;
        }
      } catch (err) {
        console.warn("Google TTS preview fallback:", err);
      }
    }

    // 2. Native Web Speech fallback
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ko-KR';

        const voice = this.getBestVoice(voiceName);
        if (voice) utterance.voice = voice;

        const isMale = voiceName && (voiceName.includes('-C') || voiceName.includes('-D'));
        if (isMale) {
          const isNativeMale = voice && (voice.name.includes('InJoon') || voice.name.includes('Male') || voice.name.includes('남성'));
          utterance.pitch = isNativeMale ? 0.95 : 0.72;
          utterance.rate = Math.max(0.7, rate * 0.92);
        } else {
          utterance.pitch = 1.05;
          utterance.rate = rate;
        }

        utterance.onend = () => { if (onEnd) onEnd(); };
        utterance.onerror = () => { if (onEnd) onEnd(); };
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        if (onEnd) onEnd();
      }
    } else {
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.currentPlayingSource) {
      try { this.currentPlayingSource.stop(); } catch (e) {}
      this.currentPlayingSource = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  /**
   * Fetch and decode real speech AudioBuffer (Google Cloud TTS Official API + Fallback)
   */
  async getTTSAudioBuffer(text, voiceName = 'ko-KR-Neural2-A', rate = 1.0) {
    if (!text || text.trim() === '') return null;
    const cleanText = text.trim();
    const cacheKey = `${voiceName}_${cleanText}_${rate}`;

    if (this.ttsBufferCache.has(cacheKey)) {
      return this.ttsBufferCache.get(cacheKey);
    }

    const ctx = this.getAudioContext();
    let rawBuffer = null;

    // 1. Official Google Cloud Text-to-Speech API
    if (this.hasApiKey()) {
      try {
        const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: cleanText },
            voice: {
              languageCode: 'ko-KR',
              name: voiceName || 'ko-KR-Neural2-A'
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: rate
            }
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.audioContent) {
            const binary = atob(json.audioContent);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            rawBuffer = await ctx.decodeAudioData(bytes.buffer);
          }
        }
      } catch (err) {
        console.warn("Google Cloud API fetch error:", err);
      }
    }

    // 2. Open Google Speech Gateway Fallbacks
    if (!rawBuffer) {
      const encoded = encodeURIComponent(cleanText);
      const gtxUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=ko&q=${encoded}`;
      const proxyList = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(gtxUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(gtxUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(gtxUrl)}`
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
        } catch (e) {}
      }
    }

    // 3. Fallback: create clear melodic chime buffer if offline
    if (!rawBuffer) {
      console.warn("Using carrier notification buffer for:", cleanText.slice(0, 15));
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
      const freq = 659.25;
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
