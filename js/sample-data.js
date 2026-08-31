/**
 * sample-data.js (V2 Hybrid Studio)
 * Pre-built Safety Templates with Image & Animated Video Motion Clips
 */

const SampleSafetyTemplates = {
  // V2 Hybrid Template: 밀폐공간 + 고소작업 하이브리드 (이미지 + 동영상 클립 혼합)
  hybridStudio: {
    title: "사내 안전보건 핵심 가이드 (V2 하이브리드)",
    cards: [
      {
        mediaType: "image",
        title: "밀폐공간 및 고소작업 안전 가이드",
        script: "사내 안전보건 핵심 수칙과 현장 작업 시연 하이브리드 비디오입니다.",
        bgGradient: ["#0f172a", "#1e293b"],
        accentColor: "#ef4444",
        badge: "V2 HYBRID STUDIO",
        icon: "⚠️",
        headline: "사내 중대재해 근절 가이드",
        subline: "이미지와 현장 시연 영상이 결합된 종합 브리핑"
      },
      {
        mediaType: "video",
        title: "현장 산소 및 유해가스 정밀 측정",
        script: "밀폐공간 진입 전 복합가스측정기로 산소농도와 유해가스를 철저히 측정합니다.",
        videoLayout: "pip",
        videoAudioMode: "mute",
        syncMode: "tts_length",
        accentColor: "#38bdf8",
        badge: "현장 영상 클립",
        icon: "💨",
        headline: "가스 측정 시연 영상",
        subline: "산소 18%~23.5% 적정 공기 유지 확인"
      },
      {
        mediaType: "image",
        title: "지속적인 송풍 환기 실시",
        script: "작업 시작 전은 물론 작업 중에도 급기 및 배기 송풍기를 계속 가동하십시오.",
        bgGradient: ["#064e3b", "#065f46"],
        accentColor: "#34d399",
        badge: "환기 원칙",
        icon: "🔄",
        headline: "강제 환기 상시 가동",
        subline: "밀폐공간 내부 유해가스 체류 방지"
      },
      {
        mediaType: "video",
        title: "고소작업 안전고리 100% 체결",
        script: "2미터 이상 높은 곳에서 작업할 때는 안전대 부착설비에 안전고리를 반드시 체결합니다.",
        videoLayout: "full",
        videoAudioMode: "mute",
        syncMode: "tts_length",
        accentColor: "#f43f5e",
        badge: "시연 영상",
        icon: "🧗",
        headline: "추락방지 안전대 체결",
        subline: "안전고리 2중 체결 및 구명줄 연결 필수"
      },
      {
        mediaType: "image",
        title: "안전제일 실천으로 무재해 달성",
        script: "철저한 안전수칙 준수로 오늘도 안전하고 건강하게 퇴근하십시오.",
        bgGradient: ["#1e1b4b", "#312e81"],
        accentColor: "#a855f7",
        badge: "안전 최우선",
        icon: "🛡️",
        headline: "오늘도 안전작업 완료!",
        subline: "작업 전 안전점검, 생명을 지키는 약속입니다."
      }
    ]
  }
};

/**
 * Generate a high-resolution SVG Card image data URL
 */
function createSvgCardDataUrl(cardData, width = 1080, height = 1080) {
  const g1 = cardData.bgGradient ? cardData.bgGradient[0] : '#0f172a';
  const g2 = cardData.bgGradient ? cardData.bgGradient[1] : '#1e293b';
  const accent = cardData.accentColor || '#22c55e';
  const badge = cardData.badge || 'SAFETY FIRST';
  const icon = cardData.icon || '🛡️';
  const headline = cardData.headline || cardData.title;
  const subline = cardData.subline || '';

  const svgString = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${g1}" />
        <stop offset="100%" stop-color="${g2}" />
      </linearGradient>
      <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${accent}" />
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.2" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      </pattern>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#cardBg)" />
    <rect width="${width}" height="${height}" fill="url(#grid)" />

    <circle cx="${width * 0.85}" cy="${height * 0.15}" r="260" fill="${accent}" opacity="0.15" filter="blur(60px)" />
    <circle cx="${width * 0.15}" cy="${height * 0.85}" r="220" fill="${accent}" opacity="0.08" filter="blur(50px)" />

    <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="28" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3" />

    <g transform="translate(80, 90)">
      <rect x="0" y="0" width="${badge.length * 20 + 70}" height="46" rx="23" fill="${accent}" opacity="0.15" stroke="${accent}" stroke-width="2" />
      <circle cx="24" cy="23" r="6" fill="${accent}" />
      <text x="42" y="29" fill="${accent}" font-family="Pretendard, sans-serif" font-size="20" font-weight="700" letter-spacing="1">${badge}</text>
    </g>

    <g transform="translate(${width / 2 - 110}, ${height * 0.28})">
      <rect x="0" y="0" width="220" height="220" rx="40" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
      <text x="110" y="145" text-anchor="middle" font-size="96">${icon}</text>
    </g>

    <rect x="120" y="${height * 0.58}" width="${width - 240}" height="4" rx="2" fill="url(#accentLine)" />

    <text x="${width / 2}" y="${height * 0.68}" text-anchor="middle" fill="#ffffff" font-family="Pretendard, sans-serif" font-size="52" font-weight="800" letter-spacing="-1">
      ${headline}
    </text>

    <text x="${width / 2}" y="${height * 0.76}" text-anchor="middle" fill="#94a3b8" font-family="Pretendard, sans-serif" font-size="28" font-weight="500">
      ${subline}
    </text>

    <g transform="translate(${width / 2 - 130}, ${height - 90})">
      <rect x="0" y="0" width="260" height="34" rx="17" fill="rgba(0,0,0,0.3)" />
      <text x="130" y="22" text-anchor="middle" fill="#64748b" font-family="Pretendard, sans-serif" font-size="14" font-weight="600" letter-spacing="2">
        SAFETY V2 • 사내 안전보건
      </text>
    </g>
  </svg>
  `;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
}

/**
 * Generate a lightweight animated safety motion video data URL using in-browser canvas recording
 */
async function createAnimatedMotionVideoDataUrl(title, icon, accentColor = '#38bdf8', durationSec = 3.0) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(25);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const recPromise = new Promise(res => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      res(URL.createObjectURL(blob));
    };
  });

  recorder.start();

  const startTime = performance.now();
  const totalMs = durationSec * 1000;

  while (performance.now() - startTime < totalMs) {
    const elapsed = (performance.now() - startTime) / 1000;
    
    // Draw motion background
    const g = ctx.createLinearGradient(0, 0, 640, 640);
    g.addColorStop(0, '#091528');
    g.addColorStop(1, '#052e16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 640);

    // Flashing safety radar circle
    const r = (elapsed * 120) % 240;
    const alpha = Math.max(0, 1 - (r / 240));
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(320, 300, r + 40, 0, Math.PI * 2);
    ctx.stroke();

    // Pulse Center Box
    ctx.globalAlpha = 1.0;
    const scale = 1.0 + 0.06 * Math.sin(elapsed * 6);
    ctx.save();
    ctx.translate(320, 300);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.fillRect(-100, -100, 200, 200);
    ctx.strokeRect(-100, -100, 200, 200);

    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 10);
    ctx.restore();

    // Text Banner
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 320, 480);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 18px Pretendard, sans-serif';
    ctx.fillText('🔴 LIVE SAFETY DEMO', 320, 520);

    await new Promise(r => setTimeout(r, 40));
  }

  recorder.stop();
  return await recPromise;
}
