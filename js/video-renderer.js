/**
 * video-renderer.js (V2.1 Audio Pro)
 * Real Audio Track Synchronizer + HTML5 Canvas & Video Exporter
 */

class VideoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isRendering = false;
    this.currentBlob = null;
    this.currentUrl = null;
    this.lastExtension = 'mp4';
  }

  setDimensions(aspectRatio = '1:1') {
    let width = 1080;
    let height = 1080;

    switch (aspectRatio) {
      case '4:5':
        width = 1080;
        height = 1350;
        break;
      case '16:9':
        width = 1920;
        height = 1080;
        break;
      case '9:16':
        width = 1080;
        height = 1920;
        break;
      case '1:1':
      default:
        width = 1080;
        height = 1080;
        break;
    }

    this.canvas.width = width;
    this.canvas.height = height;
  }

  async loadImage(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error("이미지 경로가 비어 있습니다."));
      const img = new Image();
      if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve({ type: 'image', element: img });
      img.onerror = () => reject(new Error("카드 이미지를 불러오는 데 실패했습니다."));
      img.src = src;
    });
  }

  async loadVideo(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error("동영상 경로가 비어 있습니다."));
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.preload = 'auto';
      if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
        video.crossOrigin = 'anonymous';
      }

      video.onloadeddata = () => {
        resolve({ type: 'video', element: video, duration: video.duration || 3.0 });
      };
      video.onerror = () => reject(new Error("동영상 클립을 불러오는 데 실패했습니다."));
      video.src = src;
    });
  }

  drawCardFrame(mediaObj, cardData = {}, subtitleOptions = {}, opacity = 1.0, offsetX = 0) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

    if (offsetX !== 0) {
      ctx.translate(offsetX, 0);
    }

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    if (!mediaObj) {
      ctx.restore();
      return;
    }

    const isVideo = (mediaObj.type === 'video');
    const mediaEl = mediaObj.element;
    const layout = cardData.videoLayout || 'full';

    if (isVideo && layout === 'pip') {
      this.drawPipLayout(mediaEl, cardData, w, h, ctx);
    } else {
      this.drawFullMedia(mediaEl, w, h, ctx);
    }

    if (subtitleOptions.enabled && cardData.script && cardData.script.trim() !== '') {
      this.drawSubtitles(cardData.script, subtitleOptions);
    }

    ctx.restore();
  }

  drawFullMedia(mediaEl, w, h, ctx) {
    try {
      const naturalW = mediaEl.videoWidth || mediaEl.width || 1;
      const naturalH = mediaEl.videoHeight || mediaEl.height || 1;
      const mediaRatio = naturalW / naturalH;
      const canvasRatio = w / h;

      ctx.save();
      ctx.filter = 'blur(24px) brightness(0.35)';
      ctx.drawImage(mediaEl, -20, -20, w + 40, h + 40);
      ctx.restore();

      let drawW, drawH, drawX, drawY;
      if (mediaRatio > canvasRatio) {
        drawW = w;
        drawH = w / mediaRatio;
        drawX = 0;
        drawY = (h - drawH) / 2;
      } else {
        drawH = h;
        drawW = h * mediaRatio;
        drawX = (w - drawW) / 2;
        drawY = 0;
      }

      ctx.drawImage(mediaEl, drawX, drawY, drawW, drawH);
    } catch (e) {
      console.warn("Draw full media warning:", e);
    }
  }

  drawPipLayout(videoEl, cardData, w, h, ctx) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 4;
    this.roundRect(ctx, 36, 36, w - 72, h - 72, 28);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(w * 0.045)}px Pretendard, 'Noto Sans KR', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(cardData.title || '안전 현장 시연 영상', w / 2, 70);

    const boxMarginX = w * 0.1;
    const boxTopY = h * 0.16;
    const boxW = w * 0.8;
    const boxH = h * 0.58;

    ctx.save();
    this.roundRect(ctx, boxMarginX, boxTopY, boxW, boxH, 20);
    ctx.clip();

    ctx.fillStyle = '#000000';
    ctx.fillRect(boxMarginX, boxTopY, boxW, boxH);

    try {
      const vW = videoEl.videoWidth || 1;
      const vH = videoEl.videoHeight || 1;
      const vRatio = vW / vH;
      const bRatio = boxW / boxH;
      let dW, dH, dX, dY;

      if (vRatio > bRatio) {
        dW = boxW;
        dH = boxW / vRatio;
        dX = boxMarginX;
        dY = boxTopY + (boxH - dH) / 2;
      } else {
        dH = boxH;
        dW = boxH * vRatio;
        dX = boxMarginX + (boxW - dW) / 2;
        dY = boxTopY;
      }
      ctx.drawImage(videoEl, dX, dY, dW, dH);
    } catch (e) {}

    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    this.roundRect(ctx, boxMarginX, boxTopY, boxW, boxH, 20);
    ctx.stroke();
  }

  drawSubtitles(text, options = {}) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const style = options.style || 'bottom-bar';

    const fontSize = Math.round(w * 0.038);
    const lineHeight = fontSize * 1.45;
    ctx.font = `700 ${fontSize}px Pretendard, 'Noto Sans KR', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxTextWidth = w * 0.82;
    const lines = this.wrapKoreanText(text, maxTextWidth, ctx);
    const totalBoxHeight = lines.length * lineHeight + fontSize * 1.2;

    let boxY = h - totalBoxHeight - (h * 0.05);
    if (style === 'top-bar') boxY = h * 0.05;

    if (style === 'bottom-bar' || style === 'top-bar') {
      ctx.fillStyle = 'rgba(10, 15, 29, 0.86)';
      ctx.fillRect(w * 0.05, boxY, w * 0.9, totalBoxHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.05, boxY, w * 0.9, totalBoxHeight);
    } else if (style === 'floating-pill') {
      this.roundRect(ctx, w * 0.08, boxY, w * 0.84, totalBoxHeight, 20);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    lines.forEach((line, idx) => {
      const lineY = boxY + (fontSize * 0.9) + (idx * lineHeight) + (fontSize * 0.2);
      if (style === 'text-shadow') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 6;
        ctx.strokeText(line, w / 2, lineY);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, w / 2, lineY);
    });

    ctx.shadowBlur = 0;
  }

  wrapKoreanText(text, maxWidth, ctx) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  getBestMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4'
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  /**
   * Main Hybrid Video Render Pipeline with Direct AudioBuffer Encoding
   */
  async renderVideo(cards, settings, progressCallback) {
    if (this.isRendering) return null;
    this.isRendering = true;

    try {
      this.setDimensions(settings.aspectRatio);

      if (progressCallback) progressCallback(5, "미디어 리소스 로딩 및 AI 음성 생성 중...", "오디오 트랙 준비");

      // 1. Preload all media resources (Images & Videos)
      const loadedMedia = [];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        try {
          if (card.mediaType === 'video') {
            const videoObj = await this.loadVideo(card.mediaUrl || card.imageUrl);
            loadedMedia.push(videoObj);
          } else {
            const imgObj = await this.loadImage(card.mediaUrl || card.imageUrl);
            loadedMedia.push(imgObj);
          }
        } catch (err) {
          throw new Error(`카드 ${i + 1}번 리소스를 불러오지 못했습니다: ${err.message}`);
        }
      }

      // 2. Fetch/Decode Real AudioBuffers for TTS voice narration
      const ttsAudioBuffers = [];
      const rate = settings.speechRate || 1.0;
      const voiceType = settings.voiceType || 'ko-standard-female';
      for (let i = 0; i < cards.length; i++) {
        if (progressCallback) {
          progressCallback(10 + Math.round((i / cards.length) * 15), `카드 ${i + 1} 음성 오디오 합성 중...`, cards[i].title);
        }
        let audioBuf = cards[i].customAudioBuffer;
        if (!audioBuf) {
          audioBuf = await window.ttsEngine.getTTSAudioBuffer(cards[i].script, voiceType, rate);
        }
        ttsAudioBuffers.push(audioBuf);
      }

      // 3. Setup Audio Engine & Web Audio Destination
      const audioCtx = window.ttsEngine.getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const dest = audioCtx.createMediaStreamDestination();

      // Silent carrier oscillator to keep stream alive
      const silenceOsc = audioCtx.createOscillator();
      const silenceGain = audioCtx.createGain();
      silenceGain.gain.value = 0.0001;
      silenceOsc.connect(silenceGain);
      silenceGain.connect(dest);
      silenceOsc.start();

      // Setup BGM (Custom or Procedural)
      let bgmNode = null;
      let totalEstimatedDuration = 0;
      const timeline = [];
      const pauseDuration = settings.cardPause || 0.8;

      cards.forEach((card, idx) => {
        const ttsBuf = ttsAudioBuffers[idx];
        const speechDur = ttsBuf ? ttsBuf.duration : window.ttsEngine.estimateDuration(card.script, rate);
        const mediaObj = loadedMedia[idx];
        let cardTotalDur;

        if (mediaObj.type === 'video' && card.syncMode === 'video_length' && mediaObj.duration) {
          cardTotalDur = Math.max(mediaObj.duration, speechDur) + pauseDuration;
        } else {
          cardTotalDur = speechDur + pauseDuration;
        }

        timeline.push({
          cardIndex: idx,
          card: card,
          media: mediaObj,
          ttsAudioBuffer: ttsBuf,
          speechDuration: speechDur,
          totalDuration: cardTotalDur,
          startTime: totalEstimatedDuration,
          endTime: totalEstimatedDuration + cardTotalDur
        });
        totalEstimatedDuration += cardTotalDur;
      });

      if (settings.bgmType && settings.bgmType !== 'none') {
        const bgmBuffer = window.ttsEngine.getBgmBuffer(settings.bgmType, Math.ceil(totalEstimatedDuration + 4));
        if (bgmBuffer) {
          bgmNode = audioCtx.createBufferSource();
          bgmNode.buffer = bgmBuffer;
          bgmNode.loop = true;

          const gainNode = audioCtx.createGain();
          gainNode.gain.value = settings.bgmVolume || 0.12;
          bgmNode.connect(gainNode);
          gainNode.connect(dest);
          gainNode.connect(audioCtx.destination);
        }
      }

      // 4. Setup Canvas Capture & MediaRecorder
      const fps = 30;
      const videoStream = this.canvas.captureStream(fps);
      const audioTracks = dest.stream.getAudioTracks();
      const tracks = [...videoStream.getVideoTracks()];
      if (audioTracks.length > 0) tracks.push(audioTracks[0]);

      const combinedStream = new MediaStream(tracks);
      const chosenMime = this.getBestMimeType();
      const recordedChunks = [];
      let recorder;

      try {
        recorder = new MediaRecorder(combinedStream, chosenMime ? { mimeType: chosenMime, videoBitsPerSecond: 6000000 } : {});
      } catch (e) {
        recorder = new MediaRecorder(combinedStream);
      }

      const actualMime = recorder.mimeType || chosenMime || 'video/webm';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };

      const renderPromise = new Promise((resolve, reject) => {
        recorder.onstop = () => {
          try {
            const isMp4 = actualMime.toLowerCase().includes('mp4');
            const extension = isMp4 ? 'mp4' : 'webm';
            const blob = new Blob(recordedChunks, { type: actualMime });
            this.currentBlob = blob;
            if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);
            this.currentUrl = URL.createObjectURL(blob);
            this.lastExtension = extension;
            resolve({ blob, url: this.currentUrl, extension });
          } catch (err) {
            reject(new Error("동영상 생성 실패: " + err.message));
          }
        };
        recorder.onerror = (e) => reject(e.error || new Error(e.message || "녹화 장치 에러"));
      });

      recorder.start(100);
      if (bgmNode) {
        try { bgmNode.start(); } catch (e) {}
      }

      // 5. Render timeline loop with direct AudioBuffer Voice playback
      const subtitleOpts = {
        enabled: settings.showSubtitles !== false,
        style: settings.subtitleStyle || 'bottom-bar'
      };

      const runRenderLoop = async () => {
        for (let i = 0; i < timeline.length; i++) {
          const segment = timeline[i];
          const card = segment.card;
          const media = segment.media;
          const nextSegment = (i + 1 < timeline.length) ? timeline[i + 1] : null;

          if (progressCallback) {
            const pct = 25 + Math.round((i / timeline.length) * 70);
            const typeLabel = media.type === 'video' ? '🎬 동영상' : '🖼️ 이미지';
            progressCallback(pct, `카드 ${i + 1}/${timeline.length} (${typeLabel}) 비디오 & 음성 렌더링 중`, card.title || card.script.slice(0, 25));
          }

          // Directly play TTS AudioBuffer into recording stream & speakers!
          if (segment.ttsAudioBuffer) {
            try {
              const voiceSrc = audioCtx.createBufferSource();
              voiceSrc.buffer = segment.ttsAudioBuffer;
              const voiceGain = audioCtx.createGain();
              voiceGain.gain.value = 1.35;
              voiceSrc.connect(voiceGain);
              voiceGain.connect(dest);
              voiceGain.connect(audioCtx.destination);
              voiceSrc.start(audioCtx.currentTime + 0.05);
            } catch (vErr) {
              console.warn("TTS Buffer Play warning:", vErr);
            }
          }

          window.ttsEngine.playChime(dest);

          // If media is video, start video playback
          if (media.type === 'video') {
            try {
              media.element.currentTime = 0;
              await media.element.play();
            } catch (e) {
              console.warn("Video play warning:", e);
            }
          }

          const segmentStartTime = performance.now();
          const targetDurationMs = segment.totalDuration * 1000;
          const transitionDurMs = settings.transitionStyle === 'cut' ? 0 : 400;

          while (performance.now() - segmentStartTime < targetDurationMs) {
            const elapsed = performance.now() - segmentStartTime;
            const remaining = targetDurationMs - elapsed;

            if (media.type === 'video' && media.element.ended) {
              media.element.currentTime = 0;
              media.element.play().catch(() => {});
            }

            if (remaining < transitionDurMs && nextSegment && settings.transitionStyle === 'fade') {
              const t = 1.0 - (remaining / transitionDurMs);
              this.drawCardFrame(media, card, subtitleOpts, 1.0);
              this.drawCardFrame(nextSegment.media, nextSegment.card, subtitleOpts, t);
            } else if (remaining < transitionDurMs && nextSegment && settings.transitionStyle === 'slide') {
              const t = 1.0 - (remaining / transitionDurMs);
              const offset = -t * this.canvas.width;
              this.drawCardFrame(media, card, subtitleOpts, 1.0, offset);
              this.drawCardFrame(nextSegment.media, nextSegment.card, subtitleOpts, 1.0, offset + this.canvas.width);
            } else {
              this.drawCardFrame(media, card, subtitleOpts, 1.0);
            }

            await new Promise(r => setTimeout(r, 33));
          }

          if (media.type === 'video') {
            media.element.pause();
          }
        }

        if (progressCallback) progressCallback(98, "동영상 파일 패키징 중...", "음성 및 배경음악 결합 완료");

        if (bgmNode) {
          try { bgmNode.stop(); } catch (e) {}
        }
        try { silenceOsc.stop(); } catch (e) {}

        await new Promise(r => setTimeout(r, 400));
        recorder.stop();
      };

      await runRenderLoop();
      const result = await renderPromise;
      this.isRendering = false;
      return result;

    } catch (err) {
      this.isRendering = false;
      console.error("V2.1 Video Render Error:", err);
      throw err;
    }
  }
}
